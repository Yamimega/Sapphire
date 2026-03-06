import { NextResponse } from "next/server";
import path from "path";
import { EXT_TO_MIME } from "@/lib/constants";
import { storage } from "@/lib/storage";

export async function GET() {
  const files = (await storage.list("favicon/")).filter((f) =>
    /\.(ico|png|svg|jpg|jpeg|webp)$/i.test(f)
  );

  if (files.length > 0) {
    const buffer = await storage.get(files[0]);
    if (buffer) {
      const ext = path.extname(files[0]).toLowerCase();
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": EXT_TO_MIME[ext] ?? "image/png",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
  }

  return new NextResponse(null, { status: 404 });
}
