#!/usr/bin/env node

/**
 * Creates a .env file with default variables if it does not exist.
 * Usage: node scripts/init-env.mjs
 */

import fs from "fs";
import path from "path";

const envPath = path.join(process.cwd(), ".env");

if (fs.existsSync(envPath)) {
  console.log(".env already exists — skipping.");
  process.exit(0);
}

const template = `# Sapphire Configuration
# See README.md for full documentation of all variables.

# Admin password (required for editing). Without it the app is read-only.
SAPPHIRE_PASSWORD=changeme

# Database: SQLite (default) or PostgreSQL
# Uncomment to use PostgreSQL instead of SQLite:
# DATABASE_URL=postgresql://user:password@localhost:5432/sapphire

# Watermark settings (applied to non-downloadable galleries for guests)
SAPPHIRE_WATERMARK_ENABLED=true
SAPPHIRE_WATERMARK_TEXT=PROTECTED
SAPPHIRE_WATERMARK_OPACITY=0.3
SAPPHIRE_WATERMARK_COLOR=white
SAPPHIRE_WATERMARK_STYLE=diagonal
# SAPPHIRE_WATERMARK_SIZE=0
# SAPPHIRE_WATERMARK_SPACING=0

# Image URL token expiration (seconds)
# SAPPHIRE_IMAGE_TOKEN_TTL=3600
`;

fs.writeFileSync(envPath, template);
console.log("Created .env with default settings — edit SAPPHIRE_PASSWORD before starting.");
