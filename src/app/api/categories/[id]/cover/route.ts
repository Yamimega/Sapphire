import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { formatDatetime, sha256 } from "@/lib/server-utils";
import { isAuthenticated, requireAuthResponse } from "@/lib/auth";
import { COVERS_DIR } from "@/lib/constants";
import sharp from "sharp";
import fs from "fs";
import path from "path";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  if (!(await isAuthenticated())) return requireAuthResponse();
  const { id } = await params;
  const category = db.select().from(categories).where(eq(categories.id, id)).get();
  if (!category) {
    return NextResponse.json({ error: "Album not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = sha256(buffer);
  const filename = `${hash}.webp`;

  // Convert to WebP and resize for cover
  const coverBuffer = await sharp(buffer)
    .resize(800, 800, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();

  fs.writeFileSync(path.join(COVERS_DIR, filename), coverBuffer);

  // Delete old cover if different
  if (category.coverImagePath && category.coverImagePath !== filename) {
    const oldPath = path.join(COVERS_DIR, category.coverImagePath);
    try { fs.unlinkSync(oldPath); } catch { /* ignore */ }
  }

  db.update(categories)
    .set({ coverImagePath: filename, updatedAt: formatDatetime() })
    .where(eq(categories.id, id))
    .run();

  return NextResponse.json({
    coverImageUrl: `/api/images/covers/${filename}`,
  });
}
