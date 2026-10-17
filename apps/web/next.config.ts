import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev server ishlab turganda ham tekshiruv build'i alohida papkaga chiqishi uchun
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
