import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { categories, albums } from "@/lib/db/schema";
import { eq, count, asc, sql } from "drizzle-orm";
import { generateShortId, formatDatetime } from "@/lib/server-utils";
import { isAuthenticated, requireAuthResponse } from "@/lib/auth";

export async function GET() {
  const rows = db
    .select({
      id: categories.id,
      name: categories.name,
      description: categories.description,
      coverImagePath: categories.coverImagePath,
      displayOrder: categories.displayOrder,
      createdAt: categories.createdAt,
      updatedAt: categories.updatedAt,
      galleryCount: count(albums.id),
    })
    .from(categories)
    .leftJoin(albums, eq(albums.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.displayOrder))
    .all();

  const result = rows.map((row) => ({
    ...row,
    coverImageUrl: row.coverImagePath ? `/api/images/covers/${row.coverImagePath}` : null,
  }));

  return NextResponse.json({ categories: result });
}

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) return requireAuthResponse();
  const body = await request.json();
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (name.length > 255) {
    return NextResponse.json({ error: "Name must be 255 characters or less" }, { status: 400 });
  }

  const maxOrder = db
    .select({ max: sql<number>`COALESCE(MAX(${categories.displayOrder}), -1)` })
    .from(categories)
    .get();
  const displayOrder = (maxOrder?.max ?? -1) + 1;

  const now = formatDatetime();
  const id = generateShortId();

  const category = {
    id,
    name,
    description: body.description?.trim() || "",
    coverImagePath: null,
    displayOrder,
    createdAt: now,
    updatedAt: now,
  };

  db.insert(categories).values(category).run();

  return NextResponse.json({ category: { ...category, galleryCount: 0, coverImageUrl: null } }, { status: 201 });
}
