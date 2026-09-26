import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // On Vercel the platform handles the build output natively, so we don't
  // need `output: "standalone"` (that's for self-hosted Node/Docker).
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
