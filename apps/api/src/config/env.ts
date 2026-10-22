type RawEnv = Record<string, string | undefined>;

export type DeliveryCoverageMode = "zones" | "global_fallback";

const requiredInAllEnvironments = ["DATABASE_URL", "JWT_SECRET"] as const;
const requiredInProduction = [
  "FRONTEND_URL",
  "API_PUBLIC_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SMTP_FROM",
  "TOTP_ENCRYPTION_KEY",
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
  TOTP_ENCRYPTION_KEY?: string;
  SESSION_COOKIE_DOMAIN?: string;
  SESSION_COOKIE_SAME_SITE: "lax" | "strict" | "none";
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_SUCCESS_PATH: string;
  STRIPE_CANCEL_PATH: string;
  CHECKOUT_GRACE_MINUTES: number;
  CRM_DEVELOPING_MAX_ORDERS: number;
  CRM_FREQUENT_ORDER_THRESHOLD: number;
  CRM_FREQUENT_WINDOW_DAYS: number;
  CRM_INACTIVE_DAYS: number;
  SMTP_HOST?: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  SMTP_FROM: string;
  SMTP_TIMEOUT_MS: number;
  BREVO_API_KEY?: string;
  BREVO_API_URL: string;
  DELIVERY_COVERAGE_MODE: DeliveryCoverageMode;
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
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

function parseDeliveryCoverageMode(
  value: string | undefined,
): DeliveryCoverageMode {
  const mode = (value ?? "zones").toLowerCase();
  if (mode === "zones" || mode === "global_fallback") {
    return mode;
  }

  throw new Error(
    "DELIVERY_COVERAGE_MODE must be one of: zones, global_fallback.",
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

function parseIntegerInRange(
  value: string | undefined,
  fallback: number,
  key: string,
  min: number,
  max: number,
) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${key} must be an integer between ${min} and ${max}.`);
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

function parseTimezone(value: string | undefined) {
  const timezone = value ?? "Europe/Madrid";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
  } catch {
    throw new Error("APP_TIMEZONE must be a valid IANA timezone.");
  }
  return timezone;
}

function hasAnyCloudinaryValue(env: RawEnv) {
  return Boolean(
    env.CLOUDINARY_CLOUD_NAME ||
      env.CLOUDINARY_API_KEY ||
      env.CLOUDINARY_API_SECRET,
  );
}

function validateCloudinary(env: RawEnv) {
  if (!hasAnyCloudinaryValue(env)) {
    return;
  }

  for (const key of [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ]) {
    requireValue(env, key);
  }
}

function validateTotpEncryptionKey(value: string | undefined) {
  if (!value) {
    return;
  }

  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== 32 || decoded.toString("base64") !== value) {
    throw new Error(
      "TOTP_ENCRYPTION_KEY must be exactly 32 bytes encoded as base64.",
    );
  }
}

export function validateEnvironment(env: RawEnv): AppEnv {
  for (const key of requiredInAllEnvironments) {
    requireValue(env, key);
  }

  validateCloudinary(env);
  validateTotpEncryptionKey(env.TOTP_ENCRYPTION_KEY);

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

    if (!hasAnyCloudinaryValue(env) && !env.UPLOAD_DIR) {
      throw new Error(
        "Configure Cloudinary credentials or UPLOAD_DIR in production.",
      );
    }
  }

  const crmDevelopingMaxOrders = parseIntegerInRange(
    env.CRM_DEVELOPING_MAX_ORDERS,
    2,
    "CRM_DEVELOPING_MAX_ORDERS",
    1,
    20,
  );
  const crmFrequentOrderThreshold = parseIntegerInRange(
    env.CRM_FREQUENT_ORDER_THRESHOLD,
    5,
    "CRM_FREQUENT_ORDER_THRESHOLD",
    2,
    1000,
  );
  if (crmFrequentOrderThreshold <= crmDevelopingMaxOrders) {
    throw new Error(
      "CRM_FREQUENT_ORDER_THRESHOLD must be greater than CRM_DEVELOPING_MAX_ORDERS.",
    );
  }

  return {
    NODE_ENV: env.NODE_ENV ?? "development",
    PORT: parsePositiveInteger(env.PORT, 4000, "PORT"),
    APP_TIMEZONE: parseTimezone(env.APP_TIMEZONE),
    FRONTEND_URL: env.FRONTEND_URL ?? "http://localhost:3000",
    API_PUBLIC_URL: env.API_PUBLIC_URL ?? "http://localhost:4000",
    CORS_ORIGIN: env.CORS_ORIGIN ?? env.FRONTEND_URL ?? "http://localhost:3000",
    DATABASE_URL: parseDatabaseUrl(env.DATABASE_URL!),
    JWT_SECRET: env.JWT_SECRET!,
    JWT_EXPIRES_IN: env.JWT_EXPIRES_IN ?? "7d",
    ADMIN_JWT_EXPIRES_IN: env.ADMIN_JWT_EXPIRES_IN ?? "12h",
    TOTP_ENCRYPTION_KEY: env.TOTP_ENCRYPTION_KEY,
    SESSION_COOKIE_DOMAIN: env.SESSION_COOKIE_DOMAIN,
    SESSION_COOKIE_SAME_SITE: parseSameSite(env.SESSION_COOKIE_SAME_SITE),
    STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY ?? "",
    STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET ?? "",
    STRIPE_SUCCESS_PATH:
      env.STRIPE_SUCCESS_PATH ??
      "/seguimiento/{ORDER_NUMBER}?t={TRACKING_TOKEN}",
    STRIPE_CANCEL_PATH: env.STRIPE_CANCEL_PATH ?? "/checkout?cancelled=1",
    CHECKOUT_GRACE_MINUTES: parseIntegerInRange(
      env.CHECKOUT_GRACE_MINUTES,
      15,
      "CHECKOUT_GRACE_MINUTES",
      1,
      120,
    ),
    CRM_DEVELOPING_MAX_ORDERS: crmDevelopingMaxOrders,
    CRM_FREQUENT_ORDER_THRESHOLD: crmFrequentOrderThreshold,
    CRM_FREQUENT_WINDOW_DAYS: parseIntegerInRange(
      env.CRM_FREQUENT_WINDOW_DAYS,
      90,
      "CRM_FREQUENT_WINDOW_DAYS",
      1,
      3650,
    ),
    CRM_INACTIVE_DAYS: parseIntegerInRange(
      env.CRM_INACTIVE_DAYS,
      60,
      "CRM_INACTIVE_DAYS",
      1,
      3650,
    ),
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
    DELIVERY_COVERAGE_MODE: parseDeliveryCoverageMode(
      env.DELIVERY_COVERAGE_MODE,
    ),
    CLOUDINARY_CLOUD_NAME: env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: env.CLOUDINARY_API_SECRET,
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
