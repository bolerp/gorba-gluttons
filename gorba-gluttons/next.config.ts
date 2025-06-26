import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* existing config */
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://192.248.177.90:4000/:path*", // backend IP
      },
    ];
  },
};

export default nextConfig;
