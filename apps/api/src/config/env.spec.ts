import { validateEnvironment } from "./env";

describe("environment validation", () => {
  it("requires email delivery settings in production", () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://example",
        JWT_SECRET: "a".repeat(40),
        FRONTEND_URL: "https://mordidatasty.es",
        API_PUBLIC_URL: "https://api.mordidatasty.es",
        STRIPE_SECRET_KEY: "sk_live_example",
        STRIPE_WEBHOOK_SECRET: "whsec_example",
        SMTP_FROM: "Mordida Tasty <hola@mordidatasty.es>",
        UPLOAD_DIR: "/app/uploads",
      }),
    ).toThrow("Configure BREVO_API_KEY or SMTP_HOST in production.");
  });

  it("accepts Brevo API email delivery in production", () => {
    const env = validateEnvironment({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://example",
      JWT_SECRET: "a".repeat(40),
      FRONTEND_URL: "https://mordidatasty.es",
      API_PUBLIC_URL: "https://api.mordidatasty.es",
      STRIPE_SECRET_KEY: "sk_live_example",
      STRIPE_WEBHOOK_SECRET: "whsec_example",
      SMTP_FROM: "Mordida Tasty <hola@mordidatasty.es>",
      BREVO_API_KEY: "xkeysib-example",
      UPLOAD_DIR: "/app/uploads",
    });

    expect(env.BREVO_API_KEY).toBe("xkeysib-example");
    expect(env.BREVO_API_URL).toBe("https://api.brevo.com/v3/smtp/email");
  });

  it("accepts Cloudinary uploads in production without a persistent upload directory", () => {
    const env = validateEnvironment({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://example",
      JWT_SECRET: "a".repeat(40),
      FRONTEND_URL: "https://mordidatasty.es",
      API_PUBLIC_URL: "https://api.mordidatasty.es",
      STRIPE_SECRET_KEY: "sk_live_example",
      STRIPE_WEBHOOK_SECRET: "whsec_example",
      SMTP_FROM: "Mordida Tasty <hola@mordidatasty.es>",
      BREVO_API_KEY: "xkeysib-example",
      CLOUDINARY_CLOUD_NAME: "mordida",
      CLOUDINARY_API_KEY: "cloudinary-key",
      CLOUDINARY_API_SECRET: "cloudinary-secret",
    });

    expect(env.CLOUDINARY_CLOUD_NAME).toBe("mordida");
    expect(env.UPLOAD_DIR).toBe("uploads");
  });

  it("requires complete Cloudinary credentials when one Cloudinary value is configured", () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: "postgresql://example",
        JWT_SECRET: "a".repeat(40),
        CLOUDINARY_CLOUD_NAME: "mordida",
      }),
    ).toThrow("Missing required environment variable: CLOUDINARY_API_KEY");
  });

  it("requires the public API URL and upload storage in production", () => {
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
    ).toThrow("Configure Cloudinary credentials or UPLOAD_DIR in production.");
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

  it("defaults checkout grace window to 15 minutes", () => {
    const env = validateEnvironment({
      DATABASE_URL: "postgresql://example",
      JWT_SECRET: "a".repeat(40),
    });

    expect(env.CHECKOUT_GRACE_MINUTES).toBe(15);
  });

  it("accepts a bounded checkout grace window", () => {
    const env = validateEnvironment({
      DATABASE_URL: "postgresql://example",
      JWT_SECRET: "a".repeat(40),
      CHECKOUT_GRACE_MINUTES: "30",
    });

    expect(env.CHECKOUT_GRACE_MINUTES).toBe(30);
  });

  it("uses shorter default JWT sessions for staff", () => {
    const env = validateEnvironment({
      DATABASE_URL: "postgresql://example",
      JWT_SECRET: "a".repeat(40),
    });

    expect(env.ADMIN_JWT_EXPIRES_IN).toBe("12h");
  });

  it("uses a bounded default SMTP timeout", () => {
    const env = validateEnvironment({
      DATABASE_URL: "postgresql://example",
      JWT_SECRET: "a".repeat(40),
    });

    expect(env.SMTP_TIMEOUT_MS).toBe(10_000);
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
      validateEnvironment({ ...baseEnv, SMTP_TIMEOUT_MS: "-1" }),
    ).toThrow("SMTP_TIMEOUT_MS must be a positive integer.");
    expect(() =>
      validateEnvironment({ ...baseEnv, UPLOAD_MAX_BYTES: "-1" }),
    ).toThrow("UPLOAD_MAX_BYTES must be a positive integer.");
    expect(() =>
      validateEnvironment({ ...baseEnv, CHECKOUT_GRACE_MINUTES: "0" }),
    ).toThrow("CHECKOUT_GRACE_MINUTES must be an integer between 1 and 120.");
    expect(() =>
      validateEnvironment({ ...baseEnv, CHECKOUT_GRACE_MINUTES: "121" }),
    ).toThrow("CHECKOUT_GRACE_MINUTES must be an integer between 1 and 120.");
    expect(() =>
      validateEnvironment({ ...baseEnv, CHECKOUT_GRACE_MINUTES: "abc" }),
    ).toThrow("CHECKOUT_GRACE_MINUTES must be an integer between 1 and 120.");
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
