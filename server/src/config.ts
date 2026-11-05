import { z } from "zod";
import { weatherConfigSchema } from "./calendar/weather-contracts.js";
import { isProxyRange } from "./client-address.js";

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

export interface AppConfig {
  weather?: { apiBase: string; timeoutMs: number };
  google?: {clientId: string; clientSecret: string; origin: string} | undefined;
  townEnvironmentPreviewEnabled?: boolean;
  nodeEnv: "development" | "test" | "production";
  port: number;
  databaseUrl: string;
  databaseUrlUnpooled: string | undefined;
  allowedOrigins: Set<string>;
  allowedForwardedHosts: Set<string>;
  sessionCookieName: string;
  sessionMaxAgeSeconds: number;
  allowRegistration: boolean;
  rootFallbackPassword?: string | undefined;
  maxBodyBytes: number;
  authRateLimitMax: number;
  authRateLimitWindowSeconds: number;
  authRateLimitMaxKeys: number;
  authTrustedProxyCidrs: string[];
  maxMediaBytes: number;
  trustProxyHeaders: boolean;
  renderExternalHostname: string | undefined;
  s3: S3Config | undefined;
  webauthn?: { rpId: string; origin: string } | undefined;
}

const booleanEnv = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return value;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return value;
}, z.boolean());

const csvEnv = z.string().default("").transform((value) => new Set(
  value.split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean),
));

const envSchema = z.object({
  WEATHER_API_BASE: weatherConfigSchema.shape.apiBase,
  WEATHER_TIMEOUT_MS: weatherConfigSchema.shape.timeoutMs,
  TOWN_ENVIRONMENT_PREVIEW_ENABLED: booleanEnv.default(false),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(10_000),
  DATABASE_URL: z.string().min(1).refine((value) => /^postgres(?:ql)?:\/\//i.test(value), "DATABASE_URL must be a PostgreSQL URL"),
  DATABASE_URL_UNPOOLED: z.string().min(1).optional(),
  ALLOWED_ORIGINS: csvEnv,
  ALLOWED_FORWARDED_HOSTS: csvEnv,
  SESSION_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).default("plg_session"),
  SESSION_MAX_AGE_SECONDS: z.coerce.number().int().min(300).max(2_592_000).default(604_800),
  ALLOW_REGISTRATION: booleanEnv.default(false),
  ROOT_FALLBACK_PASSWORD: z.string().min(20).max(256).optional(),
  MAX_BODY_BYTES: z.coerce.number().int().min(1_024).max(10_485_760).default(1_048_576),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(1_000).default(10),
  AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1).max(86_400).default(900),
  AUTH_RATE_LIMIT_MAX_KEYS: z.coerce.number().int().min(1).max(100_000).default(10_000),
  AUTH_TRUSTED_PROXY_CIDRS: z.string().default("").transform((value) => value.split(",").map((part) => part.trim()).filter(Boolean))
    .pipe(z.array(z.string().refine(isProxyRange, "Use explicit trusted proxy IPs or CIDRs, excluding catch-all ranges."))),
  MAX_MEDIA_BYTES: z.coerce.number().int().min(1_024).max(1_073_741_824).default(26_214_400),
  TRUST_PROXY_HEADERS: booleanEnv.default(false),
  RENDER_EXTERNAL_HOSTNAME: z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+$/).optional(),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().min(1).optional(),
  S3_BUCKET: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_FORCE_PATH_STYLE: booleanEnv.default(false),
  GOOGLE_CLIENT_ID: z.string().trim().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_AUTH_ORIGIN: z.string().url().optional(),
  WEB_AUTHN_RP_ID: z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+$/).optional(),
  WEB_AUTHN_ORIGIN: z.string().url().optional(),
});

function normalizedOrigin(value: string): string {
  return value.replace(/\/$/, "").toLowerCase();
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);
  const s3Values = [parsed.S3_ENDPOINT, parsed.S3_REGION, parsed.S3_BUCKET, parsed.S3_ACCESS_KEY_ID, parsed.S3_SECRET_ACCESS_KEY];
  const hasSomeS3 = s3Values.some((value) => value !== undefined);
  const hasAllS3 = s3Values.every((value) => value !== undefined);
  if (hasSomeS3 && !hasAllS3) {
    throw new Error("S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY must be configured together.");
  }
  if (parsed.NODE_ENV === "production" && parsed.ALLOWED_ORIGINS.size === 0) {
    throw new Error("ALLOWED_ORIGINS must contain at least one origin in production.");
  }
  if (parsed.NODE_ENV === "production" && parsed.ALLOWED_FORWARDED_HOSTS.size === 0) {
    throw new Error("ALLOWED_FORWARDED_HOSTS must contain at least one host in production.");
  }
  if (parsed.TRUST_PROXY_HEADERS && !parsed.RENDER_EXTERNAL_HOSTNAME) {
    throw new Error("RENDER_EXTERNAL_HOSTNAME is required when TRUST_PROXY_HEADERS=true.");
  }
  if ((parsed.WEB_AUTHN_RP_ID === undefined) !== (parsed.WEB_AUTHN_ORIGIN === undefined)) {
    throw new Error("WEB_AUTHN_RP_ID and WEB_AUTHN_ORIGIN must be configured together.");
  }
  const webauthn = parsed.WEB_AUTHN_RP_ID && parsed.WEB_AUTHN_ORIGIN
    ? { rpId: parsed.WEB_AUTHN_RP_ID, origin: normalizedOrigin(parsed.WEB_AUTHN_ORIGIN) }
    : parsed.NODE_ENV === "production" ? undefined : { rpId: "localhost", origin: "http://localhost:5173" };
  if (webauthn) {
    const origin = new URL(webauthn.origin);
    if (origin.origin.toLowerCase() !== webauthn.origin) {
      throw new Error("WEB_AUTHN_ORIGIN must contain only the origin, without a path or query.");
    }
    if (origin.hostname !== webauthn.rpId && !origin.hostname.endsWith(`.${webauthn.rpId}`)) {
      throw new Error("WEB_AUTHN_RP_ID must match the WebAuthn origin host or a parent domain.");
    }
    if (parsed.NODE_ENV === "production" && origin.protocol !== "https:") {
      throw new Error("WEB_AUTHN_ORIGIN must use HTTPS in production.");
    }
  }

  const googleValues = [parsed.GOOGLE_CLIENT_ID, parsed.GOOGLE_CLIENT_SECRET, parsed.GOOGLE_AUTH_ORIGIN];
  if (googleValues.some(Boolean) && !googleValues.every(Boolean)) throw new Error('Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_AUTH_ORIGIN together.');
  const google = parsed.GOOGLE_CLIENT_ID && parsed.GOOGLE_CLIENT_SECRET && parsed.GOOGLE_AUTH_ORIGIN
    ? {clientId: parsed.GOOGLE_CLIENT_ID, clientSecret: parsed.GOOGLE_CLIENT_SECRET, origin: normalizedOrigin(parsed.GOOGLE_AUTH_ORIGIN)} : undefined;
  if (google) {
    const origin = new URL(google.origin);
    if (origin.origin !== google.origin || ![...parsed.ALLOWED_ORIGINS].map(normalizedOrigin).includes(google.origin) || ![...parsed.ALLOWED_FORWARDED_HOSTS].map(host=>host.split(':')[0]).includes(origin.hostname)) throw new Error('GOOGLE_AUTH_ORIGIN must be an allowed frontend origin with no path, query or fragment.');
    if (origin.protocol !== 'https:' && !(parsed.NODE_ENV !== 'production' && origin.protocol === 'http:' && ['localhost','127.0.0.1'].includes(origin.hostname))) throw new Error('Google authentication requires HTTPS except local development.');
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    weather: { apiBase: parsed.WEATHER_API_BASE, timeoutMs: parsed.WEATHER_TIMEOUT_MS },
    google,
    townEnvironmentPreviewEnabled: parsed.TOWN_ENVIRONMENT_PREVIEW_ENABLED,
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL,
    databaseUrlUnpooled: parsed.DATABASE_URL_UNPOOLED,
    allowedOrigins: new Set([...parsed.ALLOWED_ORIGINS].map(normalizedOrigin)),
    allowedForwardedHosts: new Set([...parsed.ALLOWED_FORWARDED_HOSTS].map((value) => value.split(":")[0] ?? value)),
    sessionCookieName: parsed.SESSION_COOKIE_NAME,
    sessionMaxAgeSeconds: parsed.SESSION_MAX_AGE_SECONDS,
    allowRegistration: parsed.ALLOW_REGISTRATION,
    rootFallbackPassword: parsed.ROOT_FALLBACK_PASSWORD,
    maxBodyBytes: parsed.MAX_BODY_BYTES,
    authRateLimitMax: parsed.AUTH_RATE_LIMIT_MAX,
    authRateLimitWindowSeconds: parsed.AUTH_RATE_LIMIT_WINDOW_SECONDS,
    authRateLimitMaxKeys: parsed.AUTH_RATE_LIMIT_MAX_KEYS,
    authTrustedProxyCidrs: parsed.AUTH_TRUSTED_PROXY_CIDRS,
    maxMediaBytes: parsed.MAX_MEDIA_BYTES,
    trustProxyHeaders: parsed.TRUST_PROXY_HEADERS,
    renderExternalHostname: parsed.RENDER_EXTERNAL_HOSTNAME,
    s3: hasAllS3
      ? {
        endpoint: parsed.S3_ENDPOINT!,
        region: parsed.S3_REGION!,
        bucket: parsed.S3_BUCKET!,
        accessKeyId: parsed.S3_ACCESS_KEY_ID!,
        secretAccessKey: parsed.S3_SECRET_ACCESS_KEY!,
        forcePathStyle: parsed.S3_FORCE_PATH_STYLE,
      }
      : undefined,
    webauthn,
  };
}
