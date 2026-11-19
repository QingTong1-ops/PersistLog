import type { NextConfig } from "next";

const source = process.env.NEXT_PUBLIC_DATA_SOURCE ?? "live";
if (source !== "mock" && source !== "live") throw new Error("Invalid data source: use mock or live");

const nextConfig: NextConfig = {
  distDir: `.next/${source}`,
  typescript: { tsconfigPath: `tsconfig.${source}.json` },
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async rewrites() {
    if (source === "mock") return [];
    const backend = process.env.BACKEND_API_URL ?? "http://127.0.0.1:8000";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backend}/api/v1/:path*`,
      },
    ];
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
