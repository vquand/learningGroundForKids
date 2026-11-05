import assert from "node:assert/strict";
import test from "node:test";
import { NoSuchBucket, NoSuchKey } from "@aws-sdk/client-s3";

import {
  avatarObjectKey,
  InvalidAvatarError,
  MAX_AVATAR_BYTES,
  S3MediaStorage,
  validateAvatarUpload,
} from "../src/media.js";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);

test("avatar validation derives storage type from image bytes", () => {
  assert.deepEqual(validateAvatarUpload(jpeg, "image/jpeg"), { contentType: "image/jpeg", extension: "jpg" });
  assert.deepEqual(validateAvatarUpload(png, "image/png"), { contentType: "image/png", extension: "png" });
  assert.deepEqual(validateAvatarUpload(webp, "image/webp"), { contentType: "image/webp", extension: "webp" });
});

test("avatar validation rejects declared type mismatches and unsupported content", () => {
  assert.throws(() => validateAvatarUpload(png, "image/jpeg"), InvalidAvatarError);
  assert.throws(() => validateAvatarUpload(new Uint8Array([0x3c, 0x73, 0x76, 0x67]), "image/svg+xml"), InvalidAvatarError);
  assert.throws(() => validateAvatarUpload(new Uint8Array(), "image/png"), InvalidAvatarError);
});

test("avatar validation rejects oversized images before storage", () => {
  assert.throws(() => validateAvatarUpload(new Uint8Array(MAX_AVATAR_BYTES + 1), "image/png"), InvalidAvatarError);
});

test("avatar keys are server-generated within an owner-scoped prefix", () => {
  const key = avatarObjectKey("family-1", "profile-2", "webp");
  assert.match(key, /^profile-avatars\/family-1\/profile-2\/[0-9a-f-]{36}\.webp$/);
  assert.notEqual(key, avatarObjectKey("family-1", "profile-2", "webp"));
  assert.throws(() => avatarObjectKey("../family", "profile-2", "png"), InvalidAvatarError);
  assert.throws(() => avatarObjectKey("family-1", "profile/2", "png"), InvalidAvatarError);
});

test("S3 media reads treat a missing key as absent without hiding bucket errors", async () => {
  const storage = new S3MediaStorage({
    endpoint: "https://storage.example.test",
    region: "us-east-1",
    bucket: "media-bucket",
    accessKeyId: "test-access-key",
    secretAccessKey: "test-secret-key",
    forcePathStyle: true,
  });
  const testClient = storage as unknown as { client: { send: () => Promise<never> } };
  testClient.client = { async send() {
    throw new NoSuchKey({ $metadata: { httpStatusCode: 404 }, message: "Not found" });
  } };
  assert.equal(await storage.get("missing.png"), null);
  testClient.client = { async send() {
    throw new NoSuchBucket({ $metadata: { httpStatusCode: 404 }, message: "Bucket missing" });
  } };
  await assert.rejects(() => storage.get("bucket-missing.png"), { name: "NoSuchBucket" });
});
