import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { photos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isAuthenticated, requireAuthResponse } from "@/lib/auth";
import { deletePhotoFiles } from "@/lib/server-utils";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  if (!(await isAuthenticated())) return requireAuthResponse();
  const { id } = await params;
  const photo = db.select().from(photos).where(eq(photos.id, id)).get();
  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  const body = await request.json();
  if (body.caption !== undefined) {
    db.update(photos).set({ caption: body.caption }).where(eq(photos.id, id)).run();
  }

  const updated = db.select().from(photos).where(eq(photos.id, id)).get()!;
  return NextResponse.json({ photo: updated });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  if (!(await isAuthenticated())) return requireAuthResponse();
  const { id } = await params;
  const photo = db.select().from(photos).where(eq(photos.id, id)).get();
  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  await deletePhotoFiles(photo);

  db.delete(photos).where(eq(photos.id, id)).run();

  return NextResponse.json({ success: true });
}
