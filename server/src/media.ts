import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { S3Config } from "./config.js";

export interface StoredMedia {
  body: ReadableStream<Uint8Array>;
  contentType?: string;
  contentLength?: number;
  etag?: string;
}

export class MediaTooLargeError extends Error {
  constructor() {
    super("Media object exceeds the allowed size.");
    this.name = "MediaTooLargeError";
  }
}

export interface MediaStorage {
  get(key: string): Promise<StoredMedia | null>;
  put?(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  delete?(key: string): Promise<void>;
}

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export class InvalidAvatarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAvatarError";
  }
}

type AvatarFormat = { contentType: "image/jpeg" | "image/png" | "image/webp"; extension: "jpg" | "png" | "webp" };

export function validateAvatarUpload(bytes: Uint8Array, claimedContentType: string | undefined): AvatarFormat {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_AVATAR_BYTES) {
    throw new InvalidAvatarError("Avatar must be an image no larger than 5 MB.");
  }
  let format: AvatarFormat | undefined;
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    format = { contentType: "image/jpeg", extension: "jpg" };
  } else if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    .every((value, index) => bytes[index] === value)) {
    format = { contentType: "image/png", extension: "png" };
  } else if (bytes.length >= 12 && [0x52, 0x49, 0x46, 0x46].every((value, index) => bytes[index] === value)
    && [0x57, 0x45, 0x42, 0x50].every((value, index) => bytes[index + 8] === value)) {
    format = { contentType: "image/webp", extension: "webp" };
  }
  if (!format || (claimedContentType && claimedContentType !== format.contentType)) {
    throw new InvalidAvatarError("Avatar must be a PNG, JPEG, or WebP image.");
  }
  return format;
}

export function avatarObjectKey(familyId: string, profileId: string, extension: AvatarFormat["extension"]): string {
  const safeId = /^[A-Za-z0-9_-]{1,128}$/;
  if (!safeId.test(familyId) || !safeId.test(profileId) || !["jpg", "png", "webp"].includes(extension)) {
    throw new InvalidAvatarError("Avatar owner is invalid.");
  }
  return `profile-avatars/${familyId}/${profileId}/${randomUUID()}.${extension}`;
}

export class S3MediaStorage implements MediaStorage {
  private readonly client: S3Client;

  constructor(private readonly config: S3Config) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async get(key: string): Promise<StoredMedia | null> {
    let result;
    try {
      result = await this.client.send(new GetObjectCommand({ Bucket: this.config.bucket, Key: key }));
    } catch (caught) {
      if (caught instanceof NoSuchKey || (caught instanceof Error && caught.name === "NotFound")) return null;
      throw caught;
    }
    if (!result.Body) return null;
    const body = result.Body.transformToWebStream() as ReadableStream<Uint8Array>;
    return {
      body,
      ...(result.ContentType ? { contentType: result.ContentType } : {}),
      ...(result.ContentLength !== undefined ? { contentLength: result.ContentLength } : {}),
      ...(result.ETag ? { etag: result.ETag } : {}),
    };
  }

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      Body: bytes,
      ContentType: contentType,
      CacheControl: "private, max-age=3600",
    }));
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }
}

export function limitMediaStream(
  source: ReadableStream<Uint8Array>,
  maxBytes: number,
): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  let total = 0;
  let finished = false;
  const finish = (): void => {
    if (finished) return;
    finished = true;
    reader.releaseLock();
  };
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          finish();
          controller.close();
          return;
        }
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel("media object size limit exceeded").catch(() => undefined);
          finish();
          controller.error(new MediaTooLargeError());
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        finish();
        controller.error(error);
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        finish();
      }
    },
  });
}

export function createMediaStorage(config: S3Config | undefined): MediaStorage | undefined {
  return config ? new S3MediaStorage(config) : undefined;
}

export function parseMediaKey(pathname: string): string | null {
  if (pathname === "/media" || !pathname.startsWith("/media/")) return null;
  const encoded = pathname.slice("/media/".length);
  if (!encoded || encoded.includes("\\") || encoded.length > 512) return null;
  let key: string;
  try {
    key = decodeURIComponent(encoded);
  } catch {
    return null;
  }
  if (
    !key
    || key.startsWith("/")
    || key.includes("\u0000")
    || /[\u0000-\u001f\u007f]/.test(key)
    || key.split("/").some((segment) => segment === ".." || segment === "")
  ) return null;
  return key;
}
