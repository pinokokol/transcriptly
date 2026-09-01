import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: the site is plain files behind Caddy; the API lives at /api/*.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
