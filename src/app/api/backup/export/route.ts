import { NextResponse } from "next/server";
import { getSqlite, DB_PATH } from "@/lib/db";
import { isAuthenticated, requireAuthResponse } from "@/lib/auth";
import { isPostgres } from "@/lib/db/config";
import { storage } from "@/lib/storage";
import archiver from "archiver";
import fs from "fs";
import { PassThrough, Readable } from "stream";

// App Router route segment config: no size/time limits for large backup streaming
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  if (!(await isAuthenticated())) return requireAuthResponse();

  if (isPostgres) {
    return NextResponse.json(
      { error: "Backup export is only available in SQLite mode. Use pg_dump for PostgreSQL." },
      { status: 400 }
    );
  }

  // Flush WAL to ensure consistent backup
  getSqlite().pragma("wal_checkpoint(TRUNCATE)");

  if (!fs.existsSync(DB_PATH)) {
    return NextResponse.json({ error: "No database found" }, { status: 404 });
  }

  const passThrough = new PassThrough();
  const archive = archiver("zip", { zlib: { level: 5 } });

  archive.on("error", (err) => {
    passThrough.destroy(err);
  });

  archive.pipe(passThrough);
  archive.file(DB_PATH, { name: "database.db" });

  if (storage.localDir) {
    // Local storage: efficient directory streaming
    if (fs.existsSync(storage.localDir)) {
      archive.directory(storage.localDir, "uploads");
    }
  } else {
    // Remote storage (S3/R2): fetch files with bounded concurrency
    const keys = await storage.list("");
    const CONCURRENCY = 10;
    for (let i = 0; i < keys.length; i += CONCURRENCY) {
      const batch = keys.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map((key) => storage.get(key).then((data) => ({ key, data }))));
      for (const { key, data } of results) {
        if (data) archive.append(data, { name: `uploads/${key}` });
      }
    }
  }

  archive.finalize();

  // Stream with proper backpressure via Readable.toWeb()
  const webStream = Readable.toWeb(passThrough) as ReadableStream<Uint8Array>;

  const date = new Date().toISOString().split("T")[0];
  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="sapphire-backup-${date}.zip"`,
    },
  });
}
