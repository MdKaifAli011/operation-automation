import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["test-lead.testprepkart.com", "sales.testprepkart.com"],
  async rewrites() {
    return [
      {
        source: "/uploads/:path*",
        destination: "/api/uploads/:path*",
      },
    ];
  },
};

export default nextConfig;
