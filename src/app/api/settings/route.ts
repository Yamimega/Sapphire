import { NextRequest, NextResponse } from "next/server";
import { db, withTransaction } from "@/lib/db";
import { siteSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isAuthenticated, requireAuthResponse } from "@/lib/auth";
import { UPLOADS_DIR } from "@/lib/constants";
import fs from "fs";
import path from "path";

const DEFAULT_SETTINGS: Record<string, string> = {
  siteName: "Sapphire",
  siteDescription: "Photo Gallery Organizer",
  accentColor: "#2563eb",
  albumsPerPage: "20",
  defaultSort: "order", // order | date | name
  defaultLanguage: "en",
  showTimeline: "true",
  requireLoginToView: "false",
  thumbnailQuality: "80",
  maxUploadSizeMb: "20",
};

export async function GET() {
  const rows = db.select().from(siteSettings).all();
  const settings: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    settings[row.key] = row.value;
  }

  // Check if custom favicon exists
  const faviconDir = path.join(UPLOADS_DIR, "favicon");
  const faviconFiles = fs.existsSync(faviconDir)
    ? fs.readdirSync(faviconDir).filter((f) => /\.(ico|png|svg|jpg|jpeg|webp)$/i.test(f))
    : [];
  settings.hasFavicon = faviconFiles.length > 0 ? "true" : "false";
  if (faviconFiles.length > 0) {
    settings.faviconUrl = `/api/images/favicon/${faviconFiles[0]}`;
  }

  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  if (!(await isAuthenticated())) return requireAuthResponse();

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    // Favicon upload
    const formData = await request.formData();
    const file = formData.get("favicon") as File | null;

    if (file) {
      const faviconDir = path.join(UPLOADS_DIR, "favicon");
      fs.mkdirSync(faviconDir, { recursive: true });

      // Clear old favicons
      for (const f of fs.readdirSync(faviconDir)) {
        fs.unlinkSync(path.join(faviconDir, f));
      }

      const ext = path.extname(file.name) || ".png";
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(path.join(faviconDir, `favicon${ext}`), buffer);
    }

    return NextResponse.json({ success: true });
  }

  // JSON settings update
  const body = await request.json();
  const settings: Record<string, string> = body.settings;

  if (!settings || typeof settings !== "object") {
    return NextResponse.json({ error: "settings object required" }, { status: 400 });
  }

  const allowedKeys = new Set(Object.keys(DEFAULT_SETTINGS));
  await withTransaction(() => {
    for (const [key, value] of Object.entries(settings)) {
      if (!allowedKeys.has(key)) continue;
      db.insert(siteSettings)
        .values({ key, value: String(value) })
        .onConflictDoUpdate({ target: siteSettings.key, set: { value: String(value) } })
        .run();
    }
  });

  return NextResponse.json({ success: true });
}
