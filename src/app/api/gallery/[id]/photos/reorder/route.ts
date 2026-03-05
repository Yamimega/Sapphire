import { NextRequest, NextResponse } from "next/server";
import { db, withTransaction } from "@/lib/db";
import { albums, photos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isAuthenticated, requireAuthResponse } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  if (!(await isAuthenticated())) return requireAuthResponse();
  const { id } = await params;
  const album = db.select().from(albums).where(eq(albums.id, id)).get();
  if (!album) {
    return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
  }

  const body = await request.json();
  const photoIds: string[] = body.photoIds;

  if (!Array.isArray(photoIds) || photoIds.length === 0) {
    return NextResponse.json({ error: "photoIds must be a non-empty array" }, { status: 400 });
  }

  const existingPhotos = db
    .select({ id: photos.id })
    .from(photos)
    .where(eq(photos.albumId, id))
    .all();
  const existingIds = new Set(existingPhotos.map((p: { id: string }) => p.id));

  if (photoIds.length !== existingIds.size || !photoIds.every((pid) => existingIds.has(pid))) {
    return NextResponse.json(
      { error: "photoIds must include all photo IDs in this album" },
      { status: 400 }
    );
  }

  await withTransaction(() => {
    for (let i = 0; i < photoIds.length; i++) {
      db.update(photos).set({ displayOrder: i }).where(eq(photos.id, photoIds[i])).run();
    }
  });

  return NextResponse.json({ success: true });
}
