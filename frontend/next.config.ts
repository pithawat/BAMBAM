import type { NextConfig } from "next";

// The browser only talks to the frontend origin. /api/* (auth + API v1) and the
// SSO readiness probe are proxied to the Go API, so the registered SSO redirect
// URI on this origin reaches Go and the session cookie is first-party.
// API_INTERNAL_URL is read when the server starts / at build time.
const apiInternalUrl = (process.env.API_INTERNAL_URL ?? "http://localhost:8080").replace(/\/$/, "");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // The (app) shell renders pages only after GET /api/v1/me (client fetch), so
    // implicit instant-navigation validation would flag every page. Validate only
    // segments that opt in with `export const instant = true`.
    instantInsights: { validationLevel: "manual-warning" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiInternalUrl}/api/:path*` },
      { source: "/health/ready", destination: `${apiInternalUrl}/health/ready` },
    ];
  },
};

export default nextConfig;
