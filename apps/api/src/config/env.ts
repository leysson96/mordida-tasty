type RawEnv = Record<string, string | undefined>;

const requiredInAllEnvironments = ["DATABASE_URL", "JWT_SECRET"] as const;
const requiredInProduction = [
  "FRONTEND_URL",
  "API_PUBLIC_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SMTP_FROM",
  "UPLOAD_DIR",
] as const;

export interface AppEnv {
  NODE_ENV: string;
  PORT: number;
  APP_TIMEZONE: string;
  FRONTEND_URL: string;
  API_PUBLIC_URL: string;
  CORS_ORIGIN: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  ADMIN_JWT_EXPIRES_IN: string;
  SESSION_COOKIE_DOMAIN?: string;
  SESSION_COOKIE_SAME_SITE: "lax" | "strict" | "none";
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_SUCCESS_PATH: string;
  STRIPE_CANCEL_PATH: string;
  SMTP_HOST?: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  SMTP_FROM: string;
  SMTP_TIMEOUT_MS: number;
  BREVO_API_KEY?: string;
  BREVO_API_URL: string;
  UPLOAD_DIR: string;
  UPLOAD_MAX_BYTES: number;
}

function requireValue(env: RawEnv, key: string) {
  if (!env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

function parseSameSite(
  value: string | undefined,
): AppEnv["SESSION_COOKIE_SAME_SITE"] {
  const sameSite = (value ?? "lax").toLowerCase();
  if (sameSite === "lax" || sameSite === "strict" || sameSite === "none") {
    return sameSite;
  }

  throw new Error(
    "SESSION_COOKIE_SAME_SITE must be one of: lax, strict, none.",
  );
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  key: string,
) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer.`);
  }

  return parsed;
}

function parseDatabaseUrl(value: string) {
  if (!value.startsWith("postgresql://") && !value.startsWith("postgres://")) {
    throw new Error(
      "DATABASE_URL must start with postgresql:// or postgres://.",
    );
  }

  return value;
}

export function validateEnvironment(env: RawEnv): AppEnv {
  for (const key of requiredInAllEnvironments) {
    requireValue(env, key);
  }

  if (env.NODE_ENV === "production") {
    for (const key of requiredInProduction) {
      requireValue(env, key);
    }

    if ((env.JWT_SECRET ?? "").length < 32) {
      throw new Error(
        "JWT_SECRET must contain at least 32 characters in production.",
      );
    }

    if (!env.BREVO_API_KEY && !env.SMTP_HOST) {
      throw new Error(
        "Configure BREVO_API_KEY or SMTP_HOST in production.",
      );
    }
  }

  return {
    NODE_ENV: env.NODE_ENV ?? "development",
    PORT: parsePositiveInteger(env.PORT, 4000, "PORT"),
    APP_TIMEZONE: env.APP_TIMEZONE ?? "Europe/Madrid",
    FRONTEND_URL: env.FRONTEND_URL ?? "http://localhost:3000",
    API_PUBLIC_URL: env.API_PUBLIC_URL ?? "http://localhost:4000",
    CORS_ORIGIN: env.CORS_ORIGIN ?? env.FRONTEND_URL ?? "http://localhost:3000",
    DATABASE_URL: parseDatabaseUrl(env.DATABASE_URL!),
    JWT_SECRET: env.JWT_SECRET!,
    JWT_EXPIRES_IN: env.JWT_EXPIRES_IN ?? "7d",
    ADMIN_JWT_EXPIRES_IN: env.ADMIN_JWT_EXPIRES_IN ?? "12h",
    SESSION_COOKIE_DOMAIN: env.SESSION_COOKIE_DOMAIN,
    SESSION_COOKIE_SAME_SITE: parseSameSite(env.SESSION_COOKIE_SAME_SITE),
    STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY ?? "",
    STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET ?? "",
    STRIPE_SUCCESS_PATH:
      env.STRIPE_SUCCESS_PATH ??
      "/seguimiento/{ORDER_NUMBER}?t={TRACKING_TOKEN}",
    STRIPE_CANCEL_PATH: env.STRIPE_CANCEL_PATH ?? "/checkout?cancelled=1",
    SMTP_HOST: env.SMTP_HOST,
    SMTP_PORT: parsePositiveInteger(env.SMTP_PORT, 587, "SMTP_PORT"),
    SMTP_SECURE: env.SMTP_SECURE === "true",
    SMTP_USER: env.SMTP_USER,
    SMTP_PASSWORD: env.SMTP_PASSWORD,
    SMTP_FROM: env.SMTP_FROM ?? "Mordida Tasty <no-reply@mordidatasty.es>",
    SMTP_TIMEOUT_MS: parsePositiveInteger(
      env.SMTP_TIMEOUT_MS,
      10_000,
      "SMTP_TIMEOUT_MS",
    ),
    BREVO_API_KEY: env.BREVO_API_KEY,
    BREVO_API_URL:
      env.BREVO_API_URL ?? "https://api.brevo.com/v3/smtp/email",
    UPLOAD_DIR: env.UPLOAD_DIR ?? "uploads",
    UPLOAD_MAX_BYTES: parsePositiveInteger(
      env.UPLOAD_MAX_BYTES,
      5_242_880,
      "UPLOAD_MAX_BYTES",
    ),
  };
}

export function splitOrigins(value: string) {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
