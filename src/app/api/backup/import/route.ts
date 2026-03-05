import { NextRequest, NextResponse } from "next/server";
import { DATA_DIR, UPLOADS_DIR } from "@/lib/constants";
import { sqlite } from "@/lib/db";
import { albums, photos } from "@/lib/db/schema";
import { count } from "drizzle-orm";
import { db } from "@/lib/db";
import { isAuthenticated, requireAuthResponse } from "@/lib/auth";
import unzipper from "unzipper";
import path from "path";
import fs from "fs";
import { Readable } from "stream";

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) return requireAuthResponse();
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

  // Close current DB connection before replacing
  sqlite.close();

  try {
    // Remove existing uploads
    if (fs.existsSync(UPLOADS_DIR)) {
      fs.rmSync(UPLOADS_DIR, { recursive: true });
    }
    fs.mkdirSync(path.join(UPLOADS_DIR, "originals"), { recursive: true });
    fs.mkdirSync(path.join(UPLOADS_DIR, "thumbnails"), { recursive: true });

    // Extract all files
    for (const entry of directory.files) {
      const targetPath = path.join(DATA_DIR, entry.path);
      const resolved = path.resolve(targetPath);

      // Security: prevent path traversal
      if (!resolved.startsWith(path.resolve(DATA_DIR))) continue;

      if (entry.type === "Directory") {
        fs.mkdirSync(resolved, { recursive: true });
      } else {
        fs.mkdirSync(path.dirname(resolved), { recursive: true });
        const content = await entry.buffer();
        fs.writeFileSync(resolved, content);
      }
    }

    // Reopen the DB connection by reading the new DB
    // The singleton in db/index.ts needs a restart, but for this request
    // we can read directly
    const Database = (await import("better-sqlite3")).default;
    const newDb = new Database(path.join(DATA_DIR, "database.db"));
    newDb.pragma("journal_mode = WAL");
    newDb.pragma("foreign_keys = ON");

    const albumCount = newDb.prepare("SELECT COUNT(*) as count FROM albums").get() as {
      count: number;
    };
    const photoCount = newDb.prepare("SELECT COUNT(*) as count FROM photos").get() as {
      count: number;
    };
    newDb.close();

    // Reopen singleton - requires process restart for full effect
    // For now, reconnect via the global
    const globalForDb = globalThis as unknown as {
      _sqlite: import("better-sqlite3").Database | undefined;
    };
    globalForDb._sqlite = new Database(path.join(DATA_DIR, "database.db"));
    globalForDb._sqlite.pragma("journal_mode = WAL");
    globalForDb._sqlite.pragma("foreign_keys = ON");
    globalForDb._sqlite.pragma("busy_timeout = 5000");

    return NextResponse.json({
      success: true,
      galleryCount: albumCount.count,
      photoCount: photoCount.count,
    });
  } catch (err) {
    // Try to reopen the original DB if restore fails
    const Database = (await import("better-sqlite3")).default;
    const globalForDb = globalThis as unknown as {
      _sqlite: import("better-sqlite3").Database | undefined;
    };
    globalForDb._sqlite = new Database(path.join(DATA_DIR, "database.db"));
    globalForDb._sqlite.pragma("journal_mode = WAL");
    globalForDb._sqlite.pragma("foreign_keys = ON");

    return NextResponse.json(
      { error: `Import failed: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}
