import { NextRequest, NextResponse } from "next/server";
import { DATA_DIR, UPLOAD_SUBDIRS } from "@/lib/constants";
import { getSqlite, replaceConnection, openConnection, DB_PATH } from "@/lib/db";
import { isPostgres } from "@/lib/db/config";
import { isAuthenticated, requireAuthResponse } from "@/lib/auth";
import { storage } from "@/lib/storage";
import unzipper from "unzipper";
import path from "path";
import fs from "fs";

export const maxDuration = 300;

const CHUNK_DIR = path.join(DATA_DIR, ".import-chunks");

/**
 * Assemble chunked upload into a single file, return the path.
 * Chunks were written by /api/backup/import/chunk.
 */
function assembleChunks(uploadId: string): string {
  const sessionDir = path.join(CHUNK_DIR, uploadId);
  const metaPath = path.join(sessionDir, "meta.json");

  if (!fs.existsSync(metaPath)) {
    throw new Error("Upload session not found");
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
  const total: number = meta.total;

  // Verify all chunks exist
  for (let i = 0; i < total; i++) {
    if (!fs.existsSync(path.join(sessionDir, `${i}`))) {
      throw new Error(`Missing chunk ${i} of ${total}`);
    }
  }

  // Concatenate chunks into a single file
  const assembledPath = path.join(CHUNK_DIR, `${uploadId}.zip`);
  const fd = fs.openSync(assembledPath, "w");
  for (let i = 0; i < total; i++) {
    const chunkPath = path.join(sessionDir, `${i}`);
    const data = fs.readFileSync(chunkPath);
    fs.writeSync(fd, data);
  }
  fs.closeSync(fd);

  // Clean up chunk directory
  fs.rmSync(sessionDir, { recursive: true, force: true });

  return assembledPath;
}

function cleanupFile(filePath: string) {
  try { fs.unlinkSync(filePath); } catch { /* ignore */ }
}

/**
 * Import a backup.
 *
 * Two modes:
 * 1. Chunked: POST { uploadId } — assembles previously uploaded chunks
 * 2. Direct:  POST FormData with "backup" file (small backups, kept for backward compat)
 */
export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) return requireAuthResponse();

  if (isPostgres) {
    return NextResponse.json(
      { error: "Backup import is only available in SQLite mode. Use pg_restore for PostgreSQL." },
      { status: 400 }
    );
  }

  let zipPath: string | null = null;
  let shouldCleanup = false;

  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      // Chunked upload mode: assemble chunks
      const body = await request.json();
      const uploadId: string = body.uploadId;
      if (!uploadId || !/^[a-f0-9]{32}$/.test(uploadId)) {
        return NextResponse.json({ error: "Invalid uploadId" }, { status: 400 });
      }
      zipPath = assembleChunks(uploadId);
      shouldCleanup = true;
    } else {
      // Direct upload mode (backward compat for small files)
      const formData = await request.formData();
      const file = formData.get("backup") as File | null;

      if (!file) {
        return NextResponse.json({ error: "No backup file provided" }, { status: 400 });
      }
      if (!file.name.endsWith(".zip")) {
        return NextResponse.json({ error: "File must be a .zip archive" }, { status: 400 });
      }

      // Write to temp file instead of holding in memory
      zipPath = path.join(CHUNK_DIR, `direct-${Date.now()}.zip`);
      shouldCleanup = true;
      fs.mkdirSync(CHUNK_DIR, { recursive: true });
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(zipPath, buffer);
    }

    // Parse zip and validate structure
    const directory = await unzipper.Open.file(zipPath);
    const hasDb = directory.files.some((f) => f.path === "database.db");
    if (!hasDb) {
      return NextResponse.json({ error: "Missing database.db in archive" }, { status: 400 });
    }

    // Flush WAL before replacing
    try {
      getSqlite().pragma("wal_checkpoint(TRUNCATE)");
    } catch { /* may already be closed or not in WAL mode */ }

    // Remove WAL/SHM journal files from old database
    for (const suffix of ["-wal", "-shm"]) {
      try { fs.unlinkSync(DB_PATH + suffix); } catch { /* ENOENT is fine */ }
    }

    // Remove existing uploads
    await storage.deletePrefix("");

    // Recreate local upload directories (for local storage)
    if (storage.localDir) {
      for (const dir of UPLOAD_SUBDIRS) {
        fs.mkdirSync(path.join(storage.localDir, dir), { recursive: true });
      }
    }

    // Extract all files
    const resolvedDataDir = path.resolve(DATA_DIR);
    for (const entry of directory.files) {
      if (entry.type === "Directory") {
        // For local storage, ensure directories exist
        if (storage.localDir) {
          const targetPath = path.join(DATA_DIR, entry.path);
          const resolved = path.resolve(targetPath);
          if (resolved.startsWith(resolvedDataDir)) {
            fs.mkdirSync(resolved, { recursive: true });
          }
        }
        continue;
      }

      // Security: prevent path traversal
      if (entry.path.includes("..")) continue;

      const content = await entry.buffer();

      if (entry.path.startsWith("uploads/")) {
        // Upload files go to storage provider
        const storageKey = entry.path.slice("uploads/".length);
        if (storageKey) await storage.put(storageKey, content);
      } else {
        // Non-upload files (database.db) go to local DATA_DIR
        const targetPath = path.join(DATA_DIR, entry.path);
        const resolved = path.resolve(targetPath);
        if (!resolved.startsWith(resolvedDataDir)) continue;
        fs.mkdirSync(path.dirname(resolved), { recursive: true });
        fs.writeFileSync(resolved, content);
      }
    }

    // Open the new DB, read counts, then hot-swap
    const newConn = openConnection();

    const albumCount = newConn.prepare("SELECT COUNT(*) as count FROM albums").get() as {
      count: number;
    };
    const photoCount = newConn.prepare("SELECT COUNT(*) as count FROM photos").get() as {
      count: number;
    };

    replaceConnection(newConn);

    return NextResponse.json({
      success: true,
      galleryCount: albumCount.count,
      photoCount: photoCount.count,
    });
  } catch (err) {
    // Try to reopen the original DB if restore fails
    try {
      replaceConnection(openConnection());
    } catch { /* DB may be corrupted at this point */ }

    return NextResponse.json(
      { error: `Import failed: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 500 }
    );
  } finally {
    if (shouldCleanup && zipPath) {
      cleanupFile(zipPath);
    }
  }
}
