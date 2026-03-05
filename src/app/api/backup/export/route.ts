import { NextResponse } from "next/server";
import { sqlite, DB_PATH } from "@/lib/db";
import { UPLOADS_DIR } from "@/lib/constants";
import { isAuthenticated, requireAuthResponse } from "@/lib/auth";
import archiver from "archiver";
import fs from "fs";
import { PassThrough, Readable } from "stream";

// App Router route segment config: no size/time limits for large backup streaming
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  if (!(await isAuthenticated())) return requireAuthResponse();

  // Flush WAL to ensure consistent backup
  sqlite.pragma("wal_checkpoint(TRUNCATE)");

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

  if (fs.existsSync(UPLOADS_DIR)) {
    archive.directory(UPLOADS_DIR, "uploads");
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
