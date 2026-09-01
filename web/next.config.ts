import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  // Static export: the site is plain files behind Caddy; the API lives at /api/*.
  output: "export",
  images: { unoptimized: true },
  // The repo has its own bun.lock at the root; pin the app root so Turbopack
  // stops guessing (and stops warning about multiple lockfiles).
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
};

export default nextConfig;
