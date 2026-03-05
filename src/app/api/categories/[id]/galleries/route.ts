import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { albums, categories } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { formatDatetime } from "@/lib/server-utils";
import { isAuthenticated, requireAuthResponse } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

/** Add or remove galleries from a category */
export async function PUT(request: NextRequest, { params }: Params) {
  if (!(await isAuthenticated())) return requireAuthResponse();
  const { id } = await params;
  const category = db.select().from(categories).where(eq(categories.id, id)).get();
  if (!category) {
    return NextResponse.json({ error: "Album not found" }, { status: 404 });
  }

  const body = await request.json();
  const { galleryIds } = body;

  if (!Array.isArray(galleryIds)) {
    return NextResponse.json({ error: "galleryIds must be an array" }, { status: 400 });
  }

  db.update(albums)
    .set({ categoryId: id, updatedAt: formatDatetime() })
    .where(inArray(albums.id, galleryIds))
    .run();

  return NextResponse.json({ success: true });
}

/** Remove a gallery from this category */
export async function DELETE(request: NextRequest, { params }: Params) {
  if (!(await isAuthenticated())) return requireAuthResponse();
  const { id } = await params;

  const body = await request.json();
  const { galleryId } = body;

  if (!galleryId) {
    return NextResponse.json({ error: "galleryId is required" }, { status: 400 });
  }

  const gallery = db.select().from(albums).where(eq(albums.id, galleryId)).get();
  if (!gallery || gallery.categoryId !== id) {
    return NextResponse.json({ error: "Gallery not in this album" }, { status: 404 });
  }

  db.update(albums)
    .set({ categoryId: null, updatedAt: formatDatetime() })
    .where(eq(albums.id, galleryId))
    .run();

  return NextResponse.json({ success: true });
}
