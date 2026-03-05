import { NextRequest, NextResponse } from "next/server";
import { DATA_DIR, UPLOADS_DIR, UPLOAD_SUBDIRS } from "@/lib/constants";
import { getSqlite, replaceConnection, openConnection, DB_PATH } from "@/lib/db";
import { isPostgres } from "@/lib/db/config";
import { isAuthenticated, requireAuthResponse } from "@/lib/auth";
import unzipper from "unzipper";
import path from "path";
import fs from "fs";

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) return requireAuthResponse();

  if (isPostgres) {
    return NextResponse.json(
      { error: "Backup import is only available in SQLite mode. Use pg_restore for PostgreSQL." },
      { status: 400 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("backup") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No backup file provided" }, { status: 400 });
  }

  if (!file.name.endsWith(".zip")) {
    return NextResponse.json({ error: "File must be a .zip archive" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Parse zip and validate structure
  const directory = await unzipper.Open.buffer(buffer);
  const hasDb = directory.files.some((f) => f.path === "database.db");
  if (!hasDb) {
    return NextResponse.json({ error: "Missing database.db in archive" }, { status: 400 });
  }

  // Flush WAL before replacing
  try {
    getSqlite().pragma("wal_checkpoint(TRUNCATE)");
  } catch { /* may already be closed or not in WAL mode */ }

  try {
    // Remove WAL/SHM journal files from old database
    for (const suffix of ["-wal", "-shm"]) {
      try { fs.unlinkSync(DB_PATH + suffix); } catch { /* ENOENT is fine */ }
    }

    // Remove existing uploads
    if (fs.existsSync(UPLOADS_DIR)) {
      fs.rmSync(UPLOADS_DIR, { recursive: true });
    }

    // Recreate all upload directories
    for (const dir of UPLOAD_SUBDIRS) {
      fs.mkdirSync(path.join(UPLOADS_DIR, dir), { recursive: true });
    }

    // Extract all files
    const resolvedDataDir = path.resolve(DATA_DIR);
    for (const entry of directory.files) {
      const targetPath = path.join(DATA_DIR, entry.path);
      const resolved = path.resolve(targetPath);

      // Security: prevent path traversal
      if (!resolved.startsWith(resolvedDataDir)) continue;

      if (entry.type === "Directory") {
        fs.mkdirSync(resolved, { recursive: true });
      } else {
        fs.mkdirSync(path.dirname(resolved), { recursive: true });
        const content = await entry.buffer();
        fs.writeFileSync(resolved, content);
      }
    }

    // Open the new DB, read counts, then hot-swap (replaceConnection closes the old one)
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
  }
}
