import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { db } from "@/lib/db";
import { photos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ORIGINALS_DIR } from "@/lib/constants";
import { consumeDownloadToken } from "@/lib/image-token";
import { xorEncrypt } from "@/lib/server-utils";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { token } = await params;
  const entry = consumeDownloadToken(token);
  if (!entry) {
    return NextResponse.json({ error: "Invalid or expired download token" }, { status: 403 });
  }

  const photo = db.select().from(photos).where(eq(photos.id, entry.photoId)).get();
  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  const filePath = path.join(ORIGINALS_DIR, path.basename(photo.filepath));
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);

  // XOR encrypt the download
  const key = crypto.randomBytes(32);
  const encrypted = xorEncrypt(buffer, key);

  return new NextResponse(new Uint8Array(encrypted), {
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Image-Key": key.toString("base64"),
      "X-Download": "1",
      "Cache-Control": "private, no-store, no-cache",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(photo.filename)}.jpg"`,
    },
  });
}
