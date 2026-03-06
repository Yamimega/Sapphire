import { NextRequest, NextResponse } from "next/server";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { db } from "@/lib/db";
import { albums } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { EXT_TO_MIME } from "@/lib/constants";
import { isAuthenticated } from "@/lib/auth";
import { verifyImageSignature } from "@/lib/image-token";
import { xorEncrypt } from "@/lib/server-utils";
import { storage } from "@/lib/storage";

// Watermark config from env
type WatermarkStyle = "diagonal" | "center" | "strip" | "corner" | "cross";

const WATERMARK_ENABLED = process.env.SAPPHIRE_WATERMARK_ENABLED !== "false";
const WATERMARK_TEXT = process.env.SAPPHIRE_WATERMARK_TEXT || "PROTECTED";
const WATERMARK_OPACITY = Math.min(1, Math.max(0.01, parseFloat(process.env.SAPPHIRE_WATERMARK_OPACITY || "0.3")));
const WATERMARK_SIZE = parseInt(process.env.SAPPHIRE_WATERMARK_SIZE || "0", 10);
const WATERMARK_COLOR = process.env.SAPPHIRE_WATERMARK_COLOR || "white";
const WATERMARK_SPACING = parseInt(process.env.SAPPHIRE_WATERMARK_SPACING || "0", 10);
const WATERMARK_STYLE = (process.env.SAPPHIRE_WATERMARK_STYLE || "diagonal") as WatermarkStyle;

// Cache
const watermarkCache = new Map<string, { buffer: Buffer; width: number; height: number; ts: number }>();
const CACHE_TTL = 60_000;
const CACHE_MAX_SIZE = 50;

function cleanCache() {
  const now = Date.now();
  for (const [key, entry] of watermarkCache) {
    if (now - entry.ts > CACHE_TTL) watermarkCache.delete(key);
  }
  // Evict oldest entries if over max size
  if (watermarkCache.size > CACHE_MAX_SIZE) {
    const sorted = [...watermarkCache.entries()].sort((a, b) => a[1].ts - b[1].ts);
    for (let i = 0; i < sorted.length - CACHE_MAX_SIZE; i++) {
      watermarkCache.delete(sorted[i][0]);
    }
  }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getFill(): string {
  return WATERMARK_COLOR === "black"
    ? `rgba(0,0,0,${WATERMARK_OPACITY})`
    : `rgba(255,255,255,${WATERMARK_OPACITY})`;
}

function getFontSize(imgW: number, imgH: number): number {
  if (WATERMARK_SIZE > 0) return WATERMARK_SIZE;
  return Math.max(18, Math.min(60, Math.round(Math.min(imgW, imgH) / 16)));
}

// --- Watermark Style A: Diagonal repeating text ---
function svgDiagonal(w: number, h: number): string {
  const text = escapeXml(WATERMARK_TEXT);
  const fontSize = getFontSize(w, h);
  const fill = getFill();
  const spacingX = WATERMARK_SPACING > 0 ? WATERMARK_SPACING : fontSize * 12;
  const spacingY = WATERMARK_SPACING > 0 ? WATERMARK_SPACING : fontSize * 6;
  const diag = Math.sqrt(w * w + h * h);
  const cols = Math.ceil(diag / spacingX) + 2;
  const rows = Math.ceil(diag / spacingY) + 2;
  const ox = -(diag - w) / 2;
  const oy = -(diag - h) / 2;
  const texts: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      texts.push(`<text x="${Math.round(ox + c * spacingX)}" y="${Math.round(oy + r * spacingY)}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="${fontSize}" font-weight="bold" fill="${fill}">${text}</text>`);
    }
  }
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><g transform="rotate(-30 ${w / 2} ${h / 2})">${texts.join("")}</g></svg>`;
}

// --- Watermark Style B: Single centered text ---
function svgCenter(w: number, h: number): string {
  const text = escapeXml(WATERMARK_TEXT);
  const fontSize = WATERMARK_SIZE > 0 ? WATERMARK_SIZE : Math.max(28, Math.round(Math.min(w, h) / 8));
  const fill = getFill();
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><text x="${w / 2}" y="${h / 2}" text-anchor="middle" dominant-baseline="central" font-family="Arial,Helvetica,sans-serif" font-size="${fontSize}" font-weight="bold" fill="${fill}" transform="rotate(-20 ${w / 2} ${h / 2})">${text}</text></svg>`;
}

// --- Watermark Style C: Bottom strip ---
function svgStrip(w: number, h: number): string {
  const text = escapeXml(WATERMARK_TEXT);
  const fontSize = WATERMARK_SIZE > 0 ? WATERMARK_SIZE : Math.max(14, Math.round(Math.min(w, h) / 24));
  const stripH = fontSize * 2.5;
  const barY = h - stripH;
  const barFill = WATERMARK_COLOR === "black" ? `rgba(255,255,255,${WATERMARK_OPACITY * 0.6})` : `rgba(0,0,0,${WATERMARK_OPACITY * 0.6})`;
  const textFill = WATERMARK_COLOR === "black" ? `rgba(0,0,0,${Math.min(1, WATERMARK_OPACITY * 2)})` : `rgba(255,255,255,${Math.min(1, WATERMARK_OPACITY * 2)})`;
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="${barY}" width="${w}" height="${stripH}" fill="${barFill}"/><text x="${w / 2}" y="${barY + stripH / 2}" text-anchor="middle" dominant-baseline="central" font-family="Arial,Helvetica,sans-serif" font-size="${fontSize}" font-weight="bold" fill="${textFill}">${text}</text></svg>`;
}

// --- Watermark Style D: Corner badge ---
function svgCorner(w: number, h: number): string {
  const text = escapeXml(WATERMARK_TEXT);
  const fontSize = WATERMARK_SIZE > 0 ? WATERMARK_SIZE : Math.max(12, Math.round(Math.min(w, h) / 28));
  const fill = getFill();
  const padX = fontSize * 0.8;
  const padY = fontSize * 1.2;
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><text x="${w - padX}" y="${h - padY}" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="${fontSize}" font-weight="bold" fill="${fill}">${text}</text></svg>`;
}

// --- Watermark Style E: Cross pattern ---
function svgCross(w: number, h: number): string {
  const text = escapeXml(WATERMARK_TEXT);
  const fontSize = getFontSize(w, h);
  const fill = getFill();
  const spacing = WATERMARK_SPACING > 0 ? WATERMARK_SPACING : fontSize * 8;
  const diag = Math.sqrt(w * w + h * h);
  const count = Math.ceil(diag / spacing) + 2;
  const ox = -(diag - w) / 2;
  const oy = -(diag - h) / 2;
  const texts1: string[] = [];
  const texts2: string[] = [];
  for (let i = 0; i < count; i++) {
    const x = Math.round(ox + i * spacing);
    const y = Math.round(oy + i * spacing);
    texts1.push(`<text x="${x}" y="${y}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="${fontSize}" font-weight="bold" fill="${fill}">${text}</text>`);
    texts2.push(`<text x="${Math.round(w - (x - ox) + ox)}" y="${y}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="${fontSize}" font-weight="bold" fill="${fill}">${text}</text>`);
  }
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><g transform="rotate(-30 ${w / 2} ${h / 2})">${texts1.join("")}</g><g transform="rotate(30 ${w / 2} ${h / 2})">${texts2.join("")}</g></svg>`;
}

const STYLE_GENERATORS: Record<WatermarkStyle, (w: number, h: number) => string> = {
  diagonal: svgDiagonal,
  center: svgCenter,
  strip: svgStrip,
  corner: svgCorner,
  cross: svgCross,
};

function createWatermarkSvg(w: number, h: number): Buffer {
  const gen = STYLE_GENERATORS[WATERMARK_STYLE] || STYLE_GENERATORS.diagonal;
  return Buffer.from(gen(w, h));
}

function isImageProtected(galleryId: string): boolean {
  const album = db.select({ allowDownload: albums.allowDownload })
    .from(albums)
    .where(eq(albums.id, galleryId))
    .get();
  return album ? !album.allowDownload : false;
}

async function getWatermarkedImage(
  cacheKey: string,
  buffer: Buffer
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const cached = watermarkCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached;

  const metadata = await sharp(buffer).metadata();
  const width = metadata.width ?? 800;
  const height = metadata.height ?? 600;
  const svg = createWatermarkSvg(width, height);
  const watermarked = await sharp(buffer)
    .composite([{ input: svg, gravity: "center" }])
    .jpeg({ quality: 85 })
    .toBuffer();

  const entry = { buffer: watermarked, width, height, ts: Date.now() };
  watermarkCache.set(cacheKey, entry);
  cleanCache();
  return entry;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const segments = (await params).path;
  const storageKey = segments.join("/");

  // Validate key doesn't contain path traversal
  if (storageKey.includes("..")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const authed = await isAuthenticated();
  const isImagePath = segments[0] === "originals" || segments[0] === "thumbnails";
  const isFavicon = segments[0] === "favicon";

  const galleryId = request.nextUrl.searchParams.get("g");

  // For non-authenticated requests to originals/thumbnails, verify signed URL
  if (!authed && isImagePath) {
    const exp = request.nextUrl.searchParams.get("exp");
    const sig = request.nextUrl.searchParams.get("sig");
    const basePath = `/api/images/${storageKey}`;

    if (!verifyImageSignature(basePath, galleryId, exp, sig)) {
      return NextResponse.json({ error: "Invalid or expired image URL" }, { status: 403 });
    }
  }

  // Anti-crawl: only serve to same-origin requests
  const secFetchSite = request.headers.get("sec-fetch-site");
  const isSameOrigin = secFetchSite === "same-origin" || secFetchSite === "none" || !secFetchSite;
  if (!isSameOrigin && !isFavicon && !authed) {
    return new NextResponse(null, { status: 403, statusText: "Forbidden" });
  }

  const ext = path.extname(storageKey).toLowerCase();
  const contentType = EXT_TO_MIME[ext] ?? "application/octet-stream";

  // ETag from content hash embedded in filename (e.g. originals/abc123.jpg)
  const basename = path.basename(storageKey, ext);
  const etag = `"${basename}"`;
  const cacheControl = authed
    ? "private, max-age=31536000, immutable"
    : "public, max-age=3600, stale-while-revalidate=86400";

  // Protection (watermark + encrypt + tiles) for non-downloadable galleries
  const needsProtection = !authed && isImagePath && !!galleryId && isImageProtected(galleryId);

  // 304 Not Modified — skip for protected images (they use no-cache)
  if (!needsProtection) {
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch) {
      const tags = ifNoneMatch.split(",").map((t) => t.trim().replace(/^W\//, ""));
      if (tags.includes("*") || tags.includes(etag)) {
        return new NextResponse(null, {
          status: 304,
          headers: { "ETag": etag, "Cache-Control": cacheControl },
        });
      }
    }
  }

  const imageHeaders: Record<string, string> = {
    "Content-Type": contentType,
    "ETag": etag,
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
  };

  // X-Accel-Redirect: let nginx serve the file directly from disk.
  // Only for local storage, non-protected images. Huge perf win — no Node memory.
  // Enabled via NGINX_ACCEL=true env var (set in .env on nginx-proxied deployments).
  if (!needsProtection && storage.localDir && process.env.NGINX_ACCEL === "true") {
    return new NextResponse(null, {
      status: 200,
      headers: { ...imageHeaders, "X-Accel-Redirect": `/internal-images/${storageKey}` },
    });
  }

  const rawBuffer = await storage.get(storageKey);
  if (!rawBuffer) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  if (needsProtection) {
    const tileParam = request.nextUrl.searchParams.get("tile");
    const gridParam = request.nextUrl.searchParams.get("grid");

    let watermarked: Buffer;
    let width: number;
    let height: number;
    if (WATERMARK_ENABLED) {
      const wmResult = await getWatermarkedImage(storageKey, rawBuffer);
      watermarked = wmResult.buffer;
      width = wmResult.width;
      height = wmResult.height;
    } else {
      const metadata = await sharp(rawBuffer).metadata();
      watermarked = rawBuffer;
      width = metadata.width ?? 800;
      height = metadata.height ?? 600;
    }

    let outputBuffer = watermarked;
    if (tileParam && gridParam) {
      const [tileRow, tileCol] = tileParam.split(",").map(Number);
      const [gridRows, gridCols] = gridParam.split(",").map(Number);
      const MAX_GRID = 10;
      if (gridRows > 0 && gridRows <= MAX_GRID && gridCols > 0 && gridCols <= MAX_GRID && tileRow >= 0 && tileRow < gridRows && tileCol >= 0 && tileCol < gridCols) {
        const tileW = Math.ceil(width / gridCols);
        const tileH = Math.ceil(height / gridRows);
        const left = tileCol * tileW;
        const top = tileRow * tileH;
        outputBuffer = await sharp(watermarked)
          .extract({ left, top, width: Math.min(tileW, width - left), height: Math.min(tileH, height - top) })
          .jpeg({ quality: 80 })
          .toBuffer();
      }
    }

    const key = crypto.randomBytes(32);
    const encrypted = xorEncrypt(outputBuffer, key);

    return new NextResponse(new Uint8Array(encrypted), {
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Image-Key": key.toString("base64"),
        "X-Protected": "1",
        "X-Image-Width": String(width),
        "X-Image-Height": String(height),
        "Cache-Control": "private, no-store, no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  // Normal serving (S3 or direct access without nginx)
  return new NextResponse(new Uint8Array(rawBuffer), { headers: imageHeaders });
}
