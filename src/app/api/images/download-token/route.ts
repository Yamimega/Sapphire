import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { albums, photos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isAuthenticated } from "@/lib/auth";
import { createDownloadToken } from "@/lib/image-token";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { photoId, galleryId } = body;

  if (!photoId || !galleryId) {
    return NextResponse.json({ error: "photoId and galleryId are required" }, { status: 400 });
  }

  const authed = await isAuthenticated();

  if (!authed) {
    // Guests can only download from galleries that allow downloads
    const album = db.select({ allowDownload: albums.allowDownload })
      .from(albums)
      .where(eq(albums.id, galleryId))
      .get();
    if (!album || !album.allowDownload) {
      return NextResponse.json({ error: "Download not allowed" }, { status: 403 });
    }
  }

  // Verify photo exists and belongs to the gallery
  const photo = db.select({ id: photos.id })
    .from(photos)
    .where(eq(photos.id, photoId))
    .get();
  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  const token = createDownloadToken(photoId, galleryId);
  return NextResponse.json({ token });
}
