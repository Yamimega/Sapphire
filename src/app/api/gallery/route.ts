import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { albums, photos } from "@/lib/db/schema";
import { eq, count, asc, sql, inArray } from "drizzle-orm";
import { generateShortId, formatDate, formatDatetime, deletePhotoFiles } from "@/lib/server-utils";
import { isAuthenticated, requireAuthResponse } from "@/lib/auth";
import { signImageUrl } from "@/lib/image-token";

export async function GET() {
  const authed = await isAuthenticated();

  const rows = db
    .select({
      id: albums.id,
      title: albums.title,
      date: albums.date,
      displayOrder: albums.displayOrder,
      coverPhotoId: albums.coverPhotoId,
      categoryId: albums.categoryId,
      isPrivate: albums.isPrivate,
      allowDownload: albums.allowDownload,
      isProtected: albums.isProtected,
      createdAt: albums.createdAt,
      updatedAt: albums.updatedAt,
      photoCount: count(photos.id),
    })
    .from(albums)
    .leftJoin(photos, eq(photos.albumId, albums.id))
    .groupBy(albums.id)
    .orderBy(asc(albums.displayOrder))
    .all();

  const result = rows
    .filter((row: any) => authed || (!row.isPrivate))
    .map((row: any) => {
      const coverThumbnailUrl = row.coverPhotoId
        ? signImageUrl(`/api/images/thumbnails/${row.coverPhotoId}.webp`)
        : null;
      return { ...row, coverThumbnailUrl };
    });

  return NextResponse.json({ galleries: result });
}

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) return requireAuthResponse();
  const body = await request.json();
  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (title.length > 255) {
    return NextResponse.json({ error: "Title must be 255 characters or less" }, { status: 400 });
  }

  const date = body.date || formatDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  // Get next display order
  const maxOrder = db
    .select({ max: sql<number>`COALESCE(MAX(${albums.displayOrder}), -1)` })
    .from(albums)
    .get();
  const displayOrder = (maxOrder?.max ?? -1) + 1;

  const now = formatDatetime();
  const id = generateShortId();

  const album = {
    id,
    title,
    date,
    notes: "",
    displayOrder,
    categoryId: null,
    coverPhotoId: null,
    password: "",
    isPrivate: 0,
    allowDownload: 1,
    isProtected: 0,
    createdAt: now,
    updatedAt: now,
  };

  db.insert(albums).values(album).run();

  return NextResponse.json({ gallery: { ...album, photoCount: 0 } }, { status: 201 });
}

/** Batch delete albums */
export async function DELETE(request: NextRequest) {
  if (!(await isAuthenticated())) return requireAuthResponse();
  const body = await request.json();
  const galleryIds: string[] = body.galleryIds;

  if (!Array.isArray(galleryIds) || galleryIds.length === 0) {
    return NextResponse.json({ error: "galleryIds must be a non-empty array" }, { status: 400 });
  }

  // Delete files for all photos in these albums

  const galleryPhotos = db
    .select({ filepath: photos.filepath, thumbnailPath: photos.thumbnailPath })
    .from(photos)
    .where(inArray(photos.albumId, galleryIds))
    .all();
  await Promise.all(galleryPhotos.map((photo: any) => deletePhotoFiles(photo)));

  // Cascade delete handles photos in DB
  db.delete(albums).where(inArray(albums.id, galleryIds)).run();

  return NextResponse.json({ success: true, deletedCount: galleryIds.length });
}
