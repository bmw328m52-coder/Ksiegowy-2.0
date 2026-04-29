import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.0.143", "192.168.0.145", "192.168.0.101"],
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
      allowedOrigins: [
        "192.168.0.143:3000",
        "192.168.0.145:3000",
        "192.168.0.101:3000",
        "localhost:3000",
      ],
    },
  },
};

export default nextConfig;
