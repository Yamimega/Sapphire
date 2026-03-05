import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { UPLOADS_DIR } from "@/lib/constants";

const MIME_TYPES: Record<string, string> = {
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export async function GET() {
  const faviconDir = path.join(UPLOADS_DIR, "favicon");

  if (fs.existsSync(faviconDir)) {
    const files = fs.readdirSync(faviconDir).filter((f) =>
      /\.(ico|png|svg|jpg|jpeg|webp)$/i.test(f)
    );

    if (files.length > 0) {
      const filePath = path.join(faviconDir, files[0]);
      const ext = path.extname(files[0]).toLowerCase();
      const buffer = fs.readFileSync(filePath);

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": MIME_TYPES[ext] ?? "image/png",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
  }

  // Return 404 if no custom favicon
  return new NextResponse(null, { status: 404 });
}
