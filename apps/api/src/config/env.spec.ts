import { validateEnvironment } from "./env";

describe("environment validation", () => {
  it("requires Stripe and SMTP settings in production", () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://example",
        JWT_SECRET: "a".repeat(40),
        FRONTEND_URL: "https://mordidatasty.es",
        API_PUBLIC_URL: "https://api.mordidatasty.es",
        STRIPE_SECRET_KEY: "sk_live_example",
        STRIPE_WEBHOOK_SECRET: "whsec_example",
        UPLOAD_DIR: "/app/uploads",
      }),
    ).toThrow("Missing required environment variable: SMTP_HOST");
  });

  it("requires the public API URL and upload directory in production", () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://example",
        JWT_SECRET: "a".repeat(40),
        FRONTEND_URL: "https://mordidatasty.es",
        STRIPE_SECRET_KEY: "sk_live_example",
        STRIPE_WEBHOOK_SECRET: "whsec_example",
        SMTP_HOST: "smtp.example.com",
        SMTP_FROM: "Mordida Tasty <hola@mordidatasty.es>",
      }),
    ).toThrow("Missing required environment variable: API_PUBLIC_URL");

    expect(() =>
      validateEnvironment({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://example",
        JWT_SECRET: "a".repeat(40),
        FRONTEND_URL: "https://mordidatasty.es",
        API_PUBLIC_URL: "https://api.mordidatasty.es",
        STRIPE_SECRET_KEY: "sk_live_example",
        STRIPE_WEBHOOK_SECRET: "whsec_example",
        SMTP_HOST: "smtp.example.com",
        SMTP_FROM: "Mordida Tasty <hola@mordidatasty.es>",
      }),
    ).toThrow("Missing required environment variable: UPLOAD_DIR");
  });

  it("defaults Stripe success links to include the private tracking token", () => {
    const env = validateEnvironment({
      DATABASE_URL: "postgresql://example",
      JWT_SECRET: "a".repeat(40),
    });

    expect(env.STRIPE_SUCCESS_PATH).toBe(
      "/seguimiento/{ORDER_NUMBER}?t={TRACKING_TOKEN}",
    );
  });

  it("uses shorter default JWT sessions for staff", () => {
    const env = validateEnvironment({
      DATABASE_URL: "postgresql://example",
      JWT_SECRET: "a".repeat(40),
    });

    expect(env.ADMIN_JWT_EXPIRES_IN).toBe("12h");
  });

  it("validates configurable cookie same-site policy", () => {
    const env = validateEnvironment({
      DATABASE_URL: "postgresql://example",
      JWT_SECRET: "a".repeat(40),
      SESSION_COOKIE_SAME_SITE: "none",
    });

    expect(env.SESSION_COOKIE_SAME_SITE).toBe("none");
    expect(() =>
      validateEnvironment({
        DATABASE_URL: "postgresql://example",
        JWT_SECRET: "a".repeat(40),
        SESSION_COOKIE_SAME_SITE: "wide-open",
      }),
    ).toThrow("SESSION_COOKIE_SAME_SITE must be one of: lax, strict, none.");
  });

  it("rejects invalid numeric environment settings", () => {
    const baseEnv = {
      DATABASE_URL: "postgresql://example",
      JWT_SECRET: "a".repeat(40),
    };

    expect(() => validateEnvironment({ ...baseEnv, PORT: "abc" })).toThrow(
      "PORT must be a positive integer.",
    );
    expect(() => validateEnvironment({ ...baseEnv, SMTP_PORT: "0" })).toThrow(
      "SMTP_PORT must be a positive integer.",
    );
    expect(() =>
      validateEnvironment({ ...baseEnv, UPLOAD_MAX_BYTES: "-1" }),
    ).toThrow("UPLOAD_MAX_BYTES must be a positive integer.");
  });

  it("rejects database URLs that are not PostgreSQL connection strings", () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: "mordida-tasty-db",
        JWT_SECRET: "a".repeat(40),
      }),
    ).toThrow("DATABASE_URL must start with postgresql:// or postgres://.");
  });
});
