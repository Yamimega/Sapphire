import { NextRequest, NextResponse } from "next/server";
import { DATA_DIR } from "@/lib/constants";
import { isAuthenticated, requireAuthResponse } from "@/lib/auth";
import { isPostgres } from "@/lib/db/config";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const CHUNK_DIR = path.join(DATA_DIR, ".import-chunks");
const MAX_CHUNK_SIZE = 6 * 1024 * 1024; // 6MB (slightly above the 5MB client chunk)

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) return requireAuthResponse();

  if (isPostgres) {
    return NextResponse.json(
      { error: "Backup import is only available in SQLite mode." },
      { status: 400 }
    );
  }

  const formData = await request.formData();
  const chunk = formData.get("chunk") as File | null;
  const index = parseInt(formData.get("index") as string, 10);
  const total = parseInt(formData.get("total") as string, 10);
  const uploadId = formData.get("uploadId") as string;

  if (!chunk || isNaN(index) || isNaN(total) || !uploadId) {
    return NextResponse.json({ error: "Missing chunk, index, total, or uploadId" }, { status: 400 });
  }

  // Validate uploadId is a safe hex string
  if (!/^[a-f0-9]{32}$/.test(uploadId)) {
    return NextResponse.json({ error: "Invalid uploadId" }, { status: 400 });
  }

  if (chunk.size > MAX_CHUNK_SIZE) {
    return NextResponse.json({ error: "Chunk too large" }, { status: 400 });
  }

  if (index < 0 || index >= total || total < 1) {
    return NextResponse.json({ error: "Invalid chunk index" }, { status: 400 });
  }

  const sessionDir = path.join(CHUNK_DIR, uploadId);
  fs.mkdirSync(sessionDir, { recursive: true });

  // Write chunk to disk
  const buffer = Buffer.from(await chunk.arrayBuffer());
  fs.writeFileSync(path.join(sessionDir, `${index}`), buffer);

  // Write metadata
  const metaPath = path.join(sessionDir, "meta.json");
  if (!fs.existsSync(metaPath)) {
    fs.writeFileSync(metaPath, JSON.stringify({ total, createdAt: Date.now() }));
  }

  return NextResponse.json({ received: index });
}

/** Generate a random upload session ID */
export async function GET() {
  if (!(await isAuthenticated())) return requireAuthResponse();
  const uploadId = crypto.randomBytes(16).toString("hex");
  return NextResponse.json({ uploadId });
}
