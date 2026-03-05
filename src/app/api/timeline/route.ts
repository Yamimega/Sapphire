import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { albums, photos } from "@/lib/db/schema";
import { eq, asc, count, and, gte, lte, inArray, sql } from "drizzle-orm";
import { isAuthenticated } from "@/lib/auth";
import { signImageUrl } from "@/lib/image-token";
import { MAX_TIMELINE_THUMBNAILS } from "@/lib/constants";
import path from "path";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const authed = await isAuthenticated();

  // Build conditions
  const conditions = [];
  if (from) conditions.push(gte(albums.date, from));
  if (to) conditions.push(lte(albums.date, to));
  if (!authed) conditions.push(eq(albums.isPrivate, 0));

  const albumRows = db
    .select({
      id: albums.id,
      title: albums.title,
      date: albums.date,
      coverPhotoId: albums.coverPhotoId,
      photoCount: count(photos.id),
    })
    .from(albums)
    .leftJoin(photos, eq(photos.albumId, albums.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(albums.id)
    .orderBy(asc(albums.date))
    .all();

  // Batch-fetch thumbnails for all albums (avoids N+1)
  const albumIds = albumRows.map((a: any) => a.id);
  const thumbnailMap = new Map<string, string[]>();
  if (albumIds.length > 0) {
    // Use ROW_NUMBER to limit thumbnails per album in a single query
    const thumbRows = db
      .select({ albumId: photos.albumId, thumbnailPath: photos.thumbnailPath })
      .from(photos)
      .where(inArray(photos.albumId, albumIds))
      .orderBy(asc(photos.albumId), asc(photos.displayOrder))
      .all();

    // Group and limit per album
    for (const row of thumbRows) {
      const list = thumbnailMap.get(row.albumId) ?? [];
      if (list.length < MAX_TIMELINE_THUMBNAILS) {
        list.push(signImageUrl(`/api/images/thumbnails/${path.basename(row.thumbnailPath)}`));
        thumbnailMap.set(row.albumId, list);
      }
    }
  }

  // Group by date
  const grouped: Record<string, typeof albumRows> = {};
  for (const row of albumRows) {
    (grouped[row.date] ??= []).push(row);
  }

  const entries = Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dateGalleries]) => ({
      date,
      galleries: dateGalleries.map((g: any) => ({
        id: g.id,
        title: g.title,
        photoCount: g.photoCount,
        coverThumbnailUrl: g.coverPhotoId
          ? signImageUrl(`/api/images/thumbnails/${g.coverPhotoId}.webp`)
          : null,
        thumbnails: thumbnailMap.get(g.id) ?? [],
      })),
    }));

  return NextResponse.json({ entries });
}
