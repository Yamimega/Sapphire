import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { photos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { consumeDownloadToken } from "@/lib/image-token";
import { xorEncrypt } from "@/lib/server-utils";
import { storage } from "@/lib/storage";

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

  const buffer = await storage.get(photo.filepath);
  if (!buffer) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

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
