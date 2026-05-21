import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "192.168.0.143", "192.168.0.145", "192.168.0.101", "192.168.0.162", "192.168.0.165", "flowers-lip-nirvana-shots.trycloudflare.com"],
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
      allowedOrigins: [
        "127.0.0.1:3000",
        "192.168.0.143:3000",
        "192.168.0.145:3000",
        "192.168.0.101:3000",
        "192.168.0.162:3000",
        "192.168.0.165:3000",
        "localhost:3000",
        "flowers-lip-nirvana-shots.trycloudflare.com",
      ],
    },
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
