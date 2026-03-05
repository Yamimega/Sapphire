import { NextRequest, NextResponse } from "next/server";
import { db, sqlite } from "@/lib/db";
import { albums } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { formatDatetime } from "@/lib/server-utils";
import { isAuthenticated, requireAuthResponse } from "@/lib/auth";

export async function PUT(request: NextRequest) {
  if (!(await isAuthenticated())) return requireAuthResponse();
  const body = await request.json();
  const galleryIds: string[] = body.galleryIds;

  if (!Array.isArray(galleryIds) || galleryIds.length === 0) {
    return NextResponse.json({ error: "galleryIds must be a non-empty array" }, { status: 400 });
  }

  // Verify all albums exist
  const existingGalleries = db.select({ id: albums.id }).from(albums).all();
  const existingIds = new Set(existingGalleries.map((a) => a.id));

  if (galleryIds.length !== existingIds.size || !galleryIds.every((id) => existingIds.has(id))) {
    return NextResponse.json(
      { error: "galleryIds must include all gallery IDs" },
      { status: 400 }
    );
  }

  const now = formatDatetime();
  sqlite.transaction(() => {
    for (let i = 0; i < galleryIds.length; i++) {
      db.update(albums)
        .set({ displayOrder: i, updatedAt: now })
        .where(eq(albums.id, galleryIds[i]))
        .run();
    }
  })();

  return NextResponse.json({ success: true });
}
