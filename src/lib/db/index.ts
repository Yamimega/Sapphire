import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import fs from "fs";
import * as schema from "./schema";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "database.db");

// Ensure data directory exists
fs.mkdirSync(path.join(DATA_DIR, "uploads", "originals"), { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, "uploads", "thumbnails"), { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, "uploads", "favicon"), { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, "uploads", "covers"), { recursive: true });

// Use a singleton to avoid "database is locked" during build with multiple workers
const globalForDb = globalThis as unknown as { _sqlite: Database.Database | undefined };

if (!globalForDb._sqlite) {
  globalForDb._sqlite = new Database(DB_PATH);
  globalForDb._sqlite.pragma("journal_mode = WAL");
  globalForDb._sqlite.pragma("foreign_keys = ON");
  globalForDb._sqlite.pragma("busy_timeout = 5000");
}

const sqlite = globalForDb._sqlite;

// Migrations: add columns if missing
try {
  const albumCols = sqlite.prepare("PRAGMA table_info(albums)").all() as { name: string }[];
  const colNames = new Set(albumCols.map((c) => c.name));

  if (albumCols.length > 0) {
    if (!colNames.has("content_hash")) {
      // photos table migration
      try {
        sqlite.exec("ALTER TABLE photos ADD COLUMN content_hash TEXT NOT NULL DEFAULT ''");
      } catch { /* column may already exist */ }
    }
    if (!colNames.has("password")) {
      sqlite.exec("ALTER TABLE albums ADD COLUMN password TEXT NOT NULL DEFAULT ''");
    }
    if (!colNames.has("is_private")) {
      sqlite.exec("ALTER TABLE albums ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0");
    }
    if (!colNames.has("allow_download")) {
      sqlite.exec("ALTER TABLE albums ADD COLUMN allow_download INTEGER NOT NULL DEFAULT 1");
    }
    if (!colNames.has("is_protected")) {
      sqlite.exec("ALTER TABLE albums ADD COLUMN is_protected INTEGER NOT NULL DEFAULT 0");
    }
  }

  // Photos table migration
  const photoCols = sqlite.prepare("PRAGMA table_info(photos)").all() as { name: string }[];
  const photoColNames = new Set(photoCols.map((c) => c.name));
  if (photoCols.length > 0 && !photoColNames.has("exif_data")) {
    try {
      sqlite.exec("ALTER TABLE photos ADD COLUMN exif_data TEXT NOT NULL DEFAULT ''");
    } catch { /* column may already exist */ }
  }
  if (photoCols.length > 0 && !photoColNames.has("caption")) {
    try {
      sqlite.exec("ALTER TABLE photos ADD COLUMN caption TEXT NOT NULL DEFAULT ''");
    } catch { /* column may already exist */ }
  }

  // Albums: add category_id column
  if (albumCols.length > 0 && !colNames.has("category_id")) {
    try {
      sqlite.exec("ALTER TABLE albums ADD COLUMN category_id TEXT REFERENCES categories(id) ON DELETE SET NULL");
    } catch { /* column may already exist */ }
  }

  // Create categories table if not exists
  sqlite.exec(`CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    cover_image_path TEXT,
    display_order INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_category_display_order ON categories(display_order)`);
} catch {
  // Table may not exist yet (first run), drizzle-kit push will create it
}

export const db = drizzle(sqlite, { schema });
export { sqlite };
