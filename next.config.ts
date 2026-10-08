import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Let the dev server be opened via the loopback IP as well as "localhost".
  allowedDevOrigins: ["127.0.0.1"],
  // libSQL ships a native addon; keep it out of the server bundle.
  serverExternalPackages: ["@libsql/client", "libsql"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Allow microphone for this origin only (default policy, stated explicitly).
          { key: "Permissions-Policy", value: "microphone=(self), camera=()" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
