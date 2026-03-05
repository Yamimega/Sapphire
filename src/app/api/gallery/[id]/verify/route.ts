import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { albums } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashAlbumPassword } from "@/lib/server-utils";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const album = db.select().from(albums).where(eq(albums.id, id)).get();
  if (!album) {
    return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
  }

  if (!album.password) {
    return NextResponse.json({ success: true });
  }

  const body = await request.json();
  const hashed = hashAlbumPassword(body.password || "");

  if (hashed !== album.password) {
    return NextResponse.json({ error: "Wrong password" }, { status: 403 });
  }

  // Set album access cookie
  const response = NextResponse.json({ success: true });
  response.cookies.set(`album-${id}`, album.password, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
  });

  return response;
}
