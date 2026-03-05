#!/usr/bin/env node

/**
 * Reset Sapphire — deletes all data (database + uploads) and recreates empty directories.
 * Usage: npm run reset
 */

import fs from "fs";
import path from "path";
import readline from "readline";

const DATA_DIR = path.join(process.cwd(), "data");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  const answer = await ask(
    "This will DELETE all galleries, photos, and settings. Type 'yes' to confirm: "
  );

  if (answer.trim().toLowerCase() !== "yes") {
    console.log("Aborted.");
    rl.close();
    process.exit(0);
  }

  rl.close();

  // Remove entire data directory
  if (fs.existsSync(DATA_DIR)) {
    fs.rmSync(DATA_DIR, { recursive: true });
    console.log("Removed data/");
  } else {
    console.log("No data/ directory found — nothing to delete.");
  }

  // Recreate empty directory structure
  for (const dir of [
    path.join(DATA_DIR, "uploads", "originals"),
    path.join(DATA_DIR, "uploads", "thumbnails"),
    path.join(DATA_DIR, "uploads", "covers"),
    path.join(DATA_DIR, "uploads", "favicon"),
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log("Recreated empty data/ directories.");
  console.log("Done. Run 'npm run db:migrate' then 'npm run dev' to start fresh.");
}

main();
