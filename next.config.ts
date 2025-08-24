import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["knowing-roadrunner-799.convex.cloud"], // add your Convex hostname here
  },
};

export default nextConfig;
