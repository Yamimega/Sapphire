#!/usr/bin/env node

/**
 * Backup Sapphire — creates a zip archive of the database and uploads directory.
 * Usage: npm run backup
 *
 * Output: backups/sapphire-backup-YYYY-MM-DD-HHmmss.zip
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "database.db");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const BACKUPS_DIR = path.join(process.cwd(), "backups");

const timestamp = new Date()
  .toISOString()
  .replace(/[T:]/g, "-")
  .replace(/\..+$/, "");
const filename = `sapphire-backup-${timestamp}.zip`;
const outputPath = path.join(BACKUPS_DIR, filename);

if (!fs.existsSync(DB_PATH)) {
  console.error("No database found at data/database.db — nothing to back up.");
  process.exit(1);
}

fs.mkdirSync(BACKUPS_DIR, { recursive: true });

// Flush WAL to ensure consistent backup
try {
  const Database = (await import("better-sqlite3")).default;
  const db = new Database(DB_PATH);
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();
} catch {
  console.warn("Warning: Could not flush WAL — backup may not include latest writes.");
}

// Use tar on Unix or PowerShell on Windows to create the zip
const isWin = process.platform === "win32";

try {
  if (isWin) {
    // PowerShell Compress-Archive
    const items = [DB_PATH];
    if (fs.existsSync(UPLOADS_DIR)) items.push(UPLOADS_DIR);
    const paths = items.map((p) => `'${p}'`).join(",");
    execSync(
      `powershell -NoProfile -Command "Compress-Archive -Path ${paths} -DestinationPath '${outputPath}' -Force"`,
      { stdio: "inherit" }
    );
  } else {
    // Unix zip
    const args = ["-r", outputPath, "database.db"];
    if (fs.existsSync(UPLOADS_DIR)) args.push("uploads");
    execSync(["zip", ...args].join(" "), { cwd: DATA_DIR, stdio: "inherit" });
  }

  const size = fs.statSync(outputPath).size;
  const mb = (size / (1024 * 1024)).toFixed(1);
  console.log(`Backup created: ${path.relative(process.cwd(), outputPath)} (${mb} MB)`);
} catch (err) {
  console.error("Backup failed:", err.message);
  process.exit(1);
}
