import path from "path";
import fs from "fs";
import * as schema from "./schema";
import { DATA_DIR } from "../constants";
import { isPostgres, DATABASE_URL } from "./config";

// Storage initialization (directory creation for local, no-op for S3) is
// handled by the storage module. Import it here to ensure it runs at startup.
import "../storage";

export const DB_PATH = path.join(DATA_DIR, "database.db");

// ---------- Types ----------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DrizzleDb = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SqliteConn = any;

// ---------- Globals ----------

const globalForDb = globalThis as unknown as {
  _db: DrizzleDb | undefined;
  _sqlite: SqliteConn | undefined;
};

// ---------- SQLite helpers ----------

function applySqlitePragmas(conn: SqliteConn) {
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  conn.pragma("busy_timeout = 5000");
}

function initSqlite() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/better-sqlite3");

  const conn = new Database(DB_PATH);
  applySqlitePragmas(conn);

  // Bootstrap tables
  conn.exec(`CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
    cover_image_path TEXT, display_order INTEGER NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`);
  conn.exec(`CREATE INDEX IF NOT EXISTS idx_category_display_order ON categories(display_order)`);

  conn.exec(`CREATE TABLE IF NOT EXISTS albums (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, date TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    display_order INTEGER NOT NULL, cover_photo_id TEXT,
    password TEXT NOT NULL DEFAULT '', is_private INTEGER NOT NULL DEFAULT 0,
    allow_download INTEGER NOT NULL DEFAULT 1, is_protected INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`);
  conn.exec(`CREATE INDEX IF NOT EXISTS idx_album_date ON albums(date)`);
  conn.exec(`CREATE INDEX IF NOT EXISTS idx_album_display_order ON albums(display_order)`);

  conn.exec(`CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    album_id TEXT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    filename TEXT NOT NULL, filepath TEXT NOT NULL, thumbnail_path TEXT NOT NULL,
    content_hash TEXT NOT NULL DEFAULT '', blur_data_url TEXT NOT NULL,
    mime_type TEXT NOT NULL, file_size INTEGER NOT NULL,
    width INTEGER NOT NULL, height INTEGER NOT NULL,
    caption TEXT NOT NULL DEFAULT '', exif_data TEXT NOT NULL DEFAULT '',
    display_order INTEGER NOT NULL, uploaded_at TEXT NOT NULL
  )`);
  conn.exec(`CREATE INDEX IF NOT EXISTS idx_photo_album_id ON photos(album_id)`);
  conn.exec(`CREATE INDEX IF NOT EXISTS idx_photo_album_order ON photos(album_id, display_order)`);

  conn.exec(`CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT ''
  )`);

  // Migrations for older versions
  try {
    const albumCols = conn.prepare("PRAGMA table_info(albums)").all() as { name: string }[];
    const colNames = new Set(albumCols.map((c: { name: string }) => c.name));
    if (albumCols.length > 0) {
      if (!colNames.has("content_hash")) {
        try { conn.exec("ALTER TABLE photos ADD COLUMN content_hash TEXT NOT NULL DEFAULT ''"); } catch { /* */ }
      }
      if (!colNames.has("password")) conn.exec("ALTER TABLE albums ADD COLUMN password TEXT NOT NULL DEFAULT ''");
      if (!colNames.has("is_private")) conn.exec("ALTER TABLE albums ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0");
      if (!colNames.has("allow_download")) conn.exec("ALTER TABLE albums ADD COLUMN allow_download INTEGER NOT NULL DEFAULT 1");
      if (!colNames.has("is_protected")) conn.exec("ALTER TABLE albums ADD COLUMN is_protected INTEGER NOT NULL DEFAULT 0");
      if (!colNames.has("category_id")) {
        try { conn.exec("ALTER TABLE albums ADD COLUMN category_id TEXT REFERENCES categories(id) ON DELETE SET NULL"); } catch { /* */ }
      }
    }
    const photoCols = conn.prepare("PRAGMA table_info(photos)").all() as { name: string }[];
    const photoColNames = new Set(photoCols.map((c: { name: string }) => c.name));
    if (photoCols.length > 0) {
      if (!photoColNames.has("exif_data")) { try { conn.exec("ALTER TABLE photos ADD COLUMN exif_data TEXT NOT NULL DEFAULT ''"); } catch { /* */ } }
      if (!photoColNames.has("caption")) { try { conn.exec("ALTER TABLE photos ADD COLUMN caption TEXT NOT NULL DEFAULT ''"); } catch { /* */ } }
    }
  } catch { /* tables just created, columns exist */ }

  globalForDb._sqlite = conn;
  globalForDb._db = drizzle(conn, { schema });
}

// ---------- PostgreSQL ----------

function initPostgres() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require("pg");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/node-postgres");

  const pool = new Pool({ connectionString: DATABASE_URL });
  pool.on("error", (err: Error) => {
    console.error("PostgreSQL pool error:", err.message);
  });
  globalForDb._db = drizzle(pool, { schema });
}

// ---------- Initialize ----------

if (!globalForDb._db) {
  if (isPostgres) {
    initPostgres();
  } else {
    initSqlite();
  }
}

// ---------- Exports ----------

/** The Drizzle ORM instance — works with both SQLite and PostgreSQL */
export let db: DrizzleDb = globalForDb._db;

/**
 * Raw SQLite connection. Only available in SQLite mode.
 * Throws if running on PostgreSQL.
 */
export function getSqlite(): SqliteConn {
  if (isPostgres) throw new Error("getSqlite() is not available in PostgreSQL mode");
  return globalForDb._sqlite;
}

/** Open a new SQLite connection with standard pragmas (SQLite only) */
export function openConnection(dbPath: string = DB_PATH) {
  if (isPostgres) throw new Error("openConnection() is not available in PostgreSQL mode");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  const conn = new Database(dbPath);
  applySqlitePragmas(conn);
  return conn;
}

/** Replace the live DB connection (SQLite backup import only) */
export function replaceConnection(newConn: SqliteConn) {
  if (isPostgres) throw new Error("replaceConnection() is not available in PostgreSQL mode");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/better-sqlite3");
  const old = globalForDb._sqlite;
  globalForDb._sqlite = newConn;
  globalForDb._db = drizzle(newConn, { schema });
  db = globalForDb._db;
  try { old?.close(); } catch { /* already closed */ }
}

/**
 * Run a function inside a database transaction.
 * Works for both SQLite (synchronous) and PostgreSQL (async).
 */
export async function withTransaction<T>(fn: (tx: DrizzleDb) => T | Promise<T>): Promise<T> {
  if (isPostgres) {
    return db.transaction(async (tx: DrizzleDb) => {
      return await fn(tx);
    });
  }
  // SQLite: synchronous transaction
  const sqlite = getSqlite();
  return sqlite.transaction(() => fn(db))();
}
