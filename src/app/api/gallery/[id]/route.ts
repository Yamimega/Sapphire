import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { albums, photos } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { formatDatetime, hashAlbumPassword, deletePhotoFiles } from "@/lib/server-utils";
import { isAuthenticated, requireAuthResponse, timingSafeHexEqual } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const album = db.select().from(albums).where(eq(albums.id, id)).get();
  if (!album) {
    return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
  }

  const authed = await isAuthenticated();

  // Private gallery: only visible to admin
  if (album.isPrivate && !authed) {
    return NextResponse.json({ error: "Gallery is private" }, { status: 403 });
  }

  // Password-protected gallery: visible but requires password to view content
  if (album.isProtected && album.password && !authed) {
    const albumAuth = request.cookies.get(`album-${id}`)?.value;
    if (!albumAuth || !timingSafeHexEqual(albumAuth, album.password)) {
      return NextResponse.json(
        { error: "Password required", requirePassword: true },
        { status: 403 }
      );
    }
  }

  const photoCount = db
    .select({ count: count() })
    .from(photos)
    .where(eq(photos.albumId, id))
    .get();

  // Don't expose password hash to client
  const { password: _, ...albumData } = album;
  return NextResponse.json({
    gallery: {
      ...albumData,
      hasPassword: !!album.password,
      photoCount: photoCount?.count ?? 0,
    },
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  if (!(await isAuthenticated())) return requireAuthResponse();
  const { id } = await params;
  const existing = db.select().from(albums).where(eq(albums.id, id)).get();
  if (!existing) {
    return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = { updatedAt: formatDatetime() };

  if (body.title !== undefined) {
    const title = body.title?.trim();
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (title.length > 255) {
      return NextResponse.json({ error: "Title must be 255 characters or less" }, { status: 400 });
    }
    updates.title = title;
  }

  if (body.date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }
    updates.date = body.date;
  }

  if (body.notes !== undefined) {
    updates.notes = body.notes;
  }

  if (body.coverPhotoId !== undefined) {
    updates.coverPhotoId = body.coverPhotoId;
  }

  if (body.password !== undefined) {
    updates.password = body.password ? hashAlbumPassword(body.password) : "";
  }

  if (body.isPrivate !== undefined) {
    updates.isPrivate = body.isPrivate ? 1 : 0;
  }

  if (body.allowDownload !== undefined) {
    updates.allowDownload = body.allowDownload ? 1 : 0;
  }

  if (body.isProtected !== undefined) {
    updates.isProtected = body.isProtected ? 1 : 0;
  }

  if (body.categoryId !== undefined) {
    updates.categoryId = body.categoryId;
  }

  db.update(albums).set(updates).where(eq(albums.id, id)).run();

  const updated = db.select().from(albums).where(eq(albums.id, id)).get()!;
  const photoCount = db
    .select({ count: count() })
    .from(photos)
    .where(eq(photos.albumId, id))
    .get();

  const { password: _, ...albumData } = updated;
  return NextResponse.json({
    gallery: { ...albumData, hasPassword: !!updated.password, photoCount: photoCount?.count ?? 0 },
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  if (!(await isAuthenticated())) return requireAuthResponse();
  const { id } = await params;
  const album = db.select().from(albums).where(eq(albums.id, id)).get();
  if (!album) {
    return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
  }

  // Get photo paths to delete files
  const albumPhotos = db
    .select({ filepath: photos.filepath, thumbnailPath: photos.thumbnailPath })
    .from(photos)
    .where(eq(photos.albumId, id))
    .all();
  for (const photo of albumPhotos) {
    deletePhotoFiles(photo);
  }

  // Cascade delete handles photos in DB
  db.delete(albums).where(eq(albums.id, id)).run();

  return NextResponse.json({ success: true });
}
