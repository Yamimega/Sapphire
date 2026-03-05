import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["better-sqlite3", "sharp", "archiver", "unzipper", "pg"],
};

export default nextConfig;
