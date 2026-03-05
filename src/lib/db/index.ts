import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import fs from "fs";
import * as schema from "./schema";
import { DATA_DIR, UPLOADS_DIR, UPLOAD_SUBDIRS } from "../constants";

export const DB_PATH = path.join(DATA_DIR, "database.db");

// Ensure data directory exists
for (const dir of UPLOAD_SUBDIRS) {
  fs.mkdirSync(path.join(UPLOADS_DIR, dir), { recursive: true });
}

/** Open a new SQLite connection with standard pragmas */
export function openConnection(dbPath: string = DB_PATH): Database.Database {
  const conn = new Database(dbPath);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  conn.pragma("busy_timeout = 5000");
  return conn;
}

// Use a singleton to avoid "database is locked" during build with multiple workers
const globalForDb = globalThis as unknown as { _sqlite: Database.Database | undefined };

if (!globalForDb._sqlite) {
  globalForDb._sqlite = openConnection();
}

let sqlite = globalForDb._sqlite;

/** Replace the live DB connection (used by backup import). Closes the old connection. */
export function replaceConnection(newConn: Database.Database) {
  const old = globalForDb._sqlite;
  globalForDb._sqlite = newConn;
  sqlite = newConn;
  _db = drizzle(newConn, { schema });
  // Close old connection after swap so in-flight reads don't hit a closed DB
  try { old?.close(); } catch { /* already closed */ }
}

// Bootstrap: create tables if they don't exist (fresh deployment)
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

sqlite.exec(`CREATE TABLE IF NOT EXISTS albums (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  display_order INTEGER NOT NULL,
  cover_photo_id TEXT,
  password TEXT NOT NULL DEFAULT '',
  is_private INTEGER NOT NULL DEFAULT 0,
  allow_download INTEGER NOT NULL DEFAULT 1,
  is_protected INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`);
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_album_date ON albums(date)`);
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_album_display_order ON albums(display_order)`);

sqlite.exec(`CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  album_id TEXT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  filepath TEXT NOT NULL,
  thumbnail_path TEXT NOT NULL,
  content_hash TEXT NOT NULL DEFAULT '',
  blur_data_url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  exif_data TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL,
  uploaded_at TEXT NOT NULL
)`);
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_photo_album_id ON photos(album_id)`);
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_photo_album_order ON photos(album_id, display_order)`);

sqlite.exec(`CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
)`);

// Migrations: add columns if missing (for upgrades from older versions)
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

} catch {
  // Migrations failed — tables were just created, so columns already exist
}

let _db = drizzle(sqlite, { schema });

// Use getters so backup import can hot-swap the connection
export { sqlite, _db as db };
