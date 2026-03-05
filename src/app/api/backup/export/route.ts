import { NextResponse } from "next/server";
import { sqlite } from "@/lib/db";
import { DATA_DIR, UPLOADS_DIR } from "@/lib/constants";
import { isAuthenticated, requireAuthResponse } from "@/lib/auth";
import archiver from "archiver";
import path from "path";
import fs from "fs";
import { PassThrough } from "stream";

export async function GET() {
  if (!(await isAuthenticated())) return requireAuthResponse();
  // Flush WAL to ensure consistent backup
  sqlite.pragma("wal_checkpoint(TRUNCATE)");

  const dbPath = path.join(DATA_DIR, "database.db");
  if (!fs.existsSync(dbPath)) {
    return NextResponse.json({ error: "No database found" }, { status: 404 });
  }

  const passThrough = new PassThrough();
  const archive = archiver("zip", { zlib: { level: 5 } });

  archive.pipe(passThrough);
  archive.file(dbPath, { name: "database.db" });

  if (fs.existsSync(UPLOADS_DIR)) {
    archive.directory(UPLOADS_DIR, "uploads");
  }

  archive.finalize();

  const chunks: Buffer[] = [];
  for await (const chunk of passThrough) {
    chunks.push(chunk as Buffer);
  }
  const buffer = Buffer.concat(chunks);

  const date = new Date().toISOString().split("T")[0];
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="sapphire-backup-${date}.zip"`,
    },
  });
}
