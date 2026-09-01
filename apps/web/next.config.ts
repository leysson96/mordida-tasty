import type { NextConfig } from "next";

function apiOrigin() {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000")
      .origin;
  } catch {
    return "http://localhost:4000";
  }
}

function apiUploadRemotePattern() {
  try {
    const apiUrl = new URL(
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
    );
    return {
      protocol: apiUrl.protocol.replace(":", "") as "http" | "https",
      hostname: apiUrl.hostname,
      port: apiUrl.port,
      pathname: "/uploads/**",
    };
  } catch {
    return undefined;
  }
}

const uploadRemotePattern = apiUploadRemotePattern();
const production = process.env.NODE_ENV === "production";
const apiUrlOrigin = apiOrigin();

function contentSecurityPolicy() {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    [
      "script-src 'self' 'unsafe-inline'",
      production ? "" : "'unsafe-eval'",
      "https://www.googletagmanager.com",
      "https://www.google-analytics.com",
    ]
      .filter(Boolean)
      .join(" "),
    [
      "connect-src 'self'",
      apiUrlOrigin,
      "https://www.google-analytics.com",
      "https://region1.google-analytics.com",
      "https://analytics.google.com",
    ].join(" "),
    [
      "img-src 'self' data: blob:",
      apiUrlOrigin,
      "https://www.googletagmanager.com",
      "https://www.google-analytics.com",
    ].join(" "),
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    production ? "upgrade-insecure-requests" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

const nextConfig: NextConfig = {
  agentRules: false,
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...(production
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains",
                },
              ]
            : []),
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy(),
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      ...(uploadRemotePattern ? [uploadRemotePattern] : []),
      {
        protocol: "http",
        hostname: "localhost",
        port: "4000",
        pathname: "/uploads/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "4000",
        pathname: "/uploads/**",
      },
    ],
  },
};

export default nextConfig;
