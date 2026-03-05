import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { categories, albums } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { formatDatetime } from "@/lib/server-utils";
import { isAuthenticated, requireAuthResponse } from "@/lib/auth";
import { COVERS_DIR } from "@/lib/constants";
import fs from "fs";
import path from "path";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const category = db.select().from(categories).where(eq(categories.id, id)).get();
  if (!category) {
    return NextResponse.json({ error: "Album not found" }, { status: 404 });
  }

  const galleryCount = db
    .select({ count: count() })
    .from(albums)
    .where(eq(albums.categoryId, id))
    .get();

  return NextResponse.json({
    category: {
      ...category,
      galleryCount: galleryCount?.count ?? 0,
      coverImageUrl: category.coverImagePath
        ? `/api/images/covers/${category.coverImagePath}`
        : null,
    },
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  if (!(await isAuthenticated())) return requireAuthResponse();
  const { id } = await params;
  const existing = db.select().from(categories).where(eq(categories.id, id)).get();
  if (!existing) {
    return NextResponse.json({ error: "Album not found" }, { status: 404 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = { updatedAt: formatDatetime() };

  if (body.name !== undefined) {
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    updates.name = name;
  }

  if (body.description !== undefined) {
    updates.description = body.description;
  }

  db.update(categories).set(updates).where(eq(categories.id, id)).run();

  const updated = db.select().from(categories).where(eq(categories.id, id)).get()!;
  const galleryCount = db
    .select({ count: count() })
    .from(albums)
    .where(eq(albums.categoryId, id))
    .get();

  return NextResponse.json({
    category: {
      ...updated,
      galleryCount: galleryCount?.count ?? 0,
      coverImageUrl: updated.coverImagePath
        ? `/api/images/covers/${updated.coverImagePath}`
        : null,
    },
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  if (!(await isAuthenticated())) return requireAuthResponse();
  const { id } = await params;
  const category = db.select().from(categories).where(eq(categories.id, id)).get();
  if (!category) {
    return NextResponse.json({ error: "Album not found" }, { status: 404 });
  }

  // Delete cover image file
  if (category.coverImagePath) {
    const coverPath = path.join(COVERS_DIR, category.coverImagePath);
    try { fs.unlinkSync(coverPath); } catch { /* file may not exist */ }
  }

  // Unlink galleries from this category (set null, don't delete galleries)
  db.update(albums).set({ categoryId: null }).where(eq(albums.categoryId, id)).run();

  db.delete(categories).where(eq(categories.id, id)).run();

  return NextResponse.json({ success: true });
}
