import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    // Lint is run separately in CI; don't fail production builds on lint.
    ignoreDuringBuilds: true,
  },
  // Logo upload allows up to 2 MB; default Server Action body cap is 1 MB.
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
