import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,
  devIndicators: false,
  serverExternalPackages: ["better-sqlite3", "sharp", "archiver", "unzipper", "pg"],
};

export default nextConfig;
