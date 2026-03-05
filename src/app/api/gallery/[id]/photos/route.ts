import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { albums, photos } from "@/lib/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { generateId, formatDatetime, isAcceptedMimeType, sha256 } from "@/lib/server-utils";
import { MAX_FILE_SIZE, ORIGINALS_DIR, THUMBNAILS_DIR, THUMBNAIL_WIDTH } from "@/lib/constants";
import { isAuthenticated, requireAuthResponse } from "@/lib/auth";
import { signImageUrl } from "@/lib/image-token";
import type { ExifInfo } from "@/types";
import sharp from "sharp";
import exifReader from "exif-reader";
import fs from "fs";
import path from "path";

function extractExif(metadata: sharp.Metadata): ExifInfo {
  const info: ExifInfo = {};
  if (!metadata.exif) return info;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exif: any = exifReader(metadata.exif);

    // Image section
    const image = exif.Image || exif.image;
    if (image) {
      if (image.Make) info.cameraMake = String(image.Make).trim();
      if (image.Model) info.cameraModel = String(image.Model).trim();
      if (image.Software) info.software = String(image.Software).trim();
      if (image.Orientation) info.orientation = Number(image.Orientation);
    }

    // Photo/EXIF section
    const photo = exif.Photo || exif.Exif || exif.exif || exif.photo;
    if (photo) {
      if (photo.FocalLength) info.focalLength = `${photo.FocalLength}mm`;
      if (photo.FNumber) info.aperture = `f/${photo.FNumber}`;
      if (photo.ExposureTime) {
        info.shutterSpeed = photo.ExposureTime < 1
          ? `1/${Math.round(1 / photo.ExposureTime)}s`
          : `${photo.ExposureTime}s`;
      }
      if (photo.ISOSpeedRatings) info.iso = Number(photo.ISOSpeedRatings);
      if (photo.ISO) info.iso = Number(photo.ISO);
      if (photo.DateTimeOriginal) {
        info.dateTaken = photo.DateTimeOriginal instanceof Date
          ? photo.DateTimeOriginal.toISOString()
          : String(photo.DateTimeOriginal);
      }
      if (photo.LensModel) info.lens = String(photo.LensModel).trim();
    }

    // GPS section
    const gps = exif.GPSInfo || exif.gps || exif.GPS;
    if (gps) {
      if (gps.GPSLatitude && gps.GPSLatitudeRef) {
        const lat = gps.GPSLatitude;
        if (Array.isArray(lat) && lat.length === 3) {
          const decimal = lat[0] + lat[1] / 60 + lat[2] / 3600;
          info.gpsLatitude = gps.GPSLatitudeRef === "S" ? -decimal : decimal;
        }
      }
      if (gps.GPSLongitude && gps.GPSLongitudeRef) {
        const lng = gps.GPSLongitude;
        if (Array.isArray(lng) && lng.length === 3) {
          const decimal = lng[0] + lng[1] / 60 + lng[2] / 3600;
          info.gpsLongitude = gps.GPSLongitudeRef === "W" ? -decimal : decimal;
        }
      }
    }
  } catch {
    // EXIF parsing failed, return what we have
  }

  return info;
}

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const album = db.select().from(albums).where(eq(albums.id, id)).get();
  if (!album) {
    return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
  }

  const authed = await isAuthenticated();

  // Private gallery: admin only
  if (album.isPrivate && !authed) {
    return NextResponse.json({ error: "Gallery is private" }, { status: 403 });
  }

  // Password-protected gallery: check cookie
  if (album.isProtected && album.password && !authed) {
    const albumAuth = request.cookies.get(`album-${id}`)?.value;
    if (!albumAuth || albumAuth !== album.password) {
      return NextResponse.json({ error: "Password required" }, { status: 403 });
    }
  }

  const rows = db
    .select()
    .from(photos)
    .where(eq(photos.albumId, id))
    .orderBy(asc(photos.displayOrder))
    .all();

  const result = rows.map((photo) => ({
    ...photo,
    url: signImageUrl(`/api/images/originals/${path.basename(photo.filepath)}`, id),
    thumbnailUrl: signImageUrl(`/api/images/thumbnails/${path.basename(photo.thumbnailPath)}`, id),
  }));

  return NextResponse.json({ photos: result, allowDownload: !!album.allowDownload });
}

export async function POST(request: NextRequest, { params }: Params) {
  if (!(await isAuthenticated())) return requireAuthResponse();
  const { id } = await params;
  const album = db.select().from(albums).where(eq(albums.id, id)).get();
  if (!album) {
    return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files") as File[];
  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  // Validate all files first
  for (const file of files) {
    if (!isAcceptedMimeType(file.type)) {
      return NextResponse.json(
        { error: `Unsupported format: ${file.type}. Accepted: JPEG, PNG, WebP, GIF` },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large: ${file.name}. Max 20MB` },
        { status: 400 }
      );
    }
  }

  // Get current max display order
  const maxOrder = db
    .select({ max: sql<number>`COALESCE(MAX(${photos.displayOrder}), -1)` })
    .from(photos)
    .where(eq(photos.albumId, id))
    .get();
  let nextOrder = (maxOrder?.max ?? -1) + 1;

  // Pre-fetch existing hashes to avoid N+1 queries
  const existingHashes = new Set(
    db.select({ contentHash: photos.contentHash })
      .from(photos)
      .where(eq(photos.albumId, id))
      .all()
      .map((p) => p.contentHash)
  );

  const created = [];
  let skippedDupes = 0;

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const contentHash = sha256(buffer);

    // Skip duplicate: same content already in this album
    if (existingHashes.has(contentHash)) {
      skippedDupes++;
      continue;
    }

    const isJpeg = file.type === "image/jpeg";
    const originalFilename = `${contentHash}.jpg`;
    const thumbnailFilename = `${contentHash}.webp`;

    // Get metadata and EXIF from original buffer
    const metadata = await sharp(buffer).metadata();
    const exifInfo = extractExif(metadata);

    // Save original — skip conversion if already JPEG
    const originalPath = path.join(ORIGINALS_DIR, originalFilename);
    let savedSize = file.size;
    if (!fs.existsSync(originalPath)) {
      if (isJpeg) {
        fs.writeFileSync(originalPath, buffer);
        savedSize = buffer.length;
      } else {
        const jpegBuffer = await sharp(buffer)
          .keepMetadata()
          .jpeg({ quality: 92, mozjpeg: true })
          .toBuffer();
        fs.writeFileSync(originalPath, jpegBuffer);
        savedSize = jpegBuffer.length;
      }
    } else {
      savedSize = fs.statSync(originalPath).size;
    }

    // Generate thumbnail (may already exist)
    const thumbnailPath = path.join(THUMBNAILS_DIR, thumbnailFilename);
    if (!fs.existsSync(thumbnailPath)) {
      const thumbnailBuffer = await sharp(buffer)
        .resize(THUMBNAIL_WIDTH, undefined, { withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      fs.writeFileSync(thumbnailPath, thumbnailBuffer);
    }

    // Generate blur placeholder
    const blurBuffer = await sharp(buffer).resize(10).webp({ quality: 20 }).toBuffer();
    const blurDataUrl = `data:image/webp;base64,${blurBuffer.toString("base64")}`;

    const photoId = generateId();
    const exifJson = Object.keys(exifInfo).length > 0 ? JSON.stringify(exifInfo) : "";
    const photo = {
      id: photoId,
      albumId: id,
      filename: file.name.replace(/\.[^.]+$/, ""),
      filepath: `originals/${originalFilename}`,
      thumbnailPath: `thumbnails/${thumbnailFilename}`,
      contentHash,
      blurDataUrl,
      mimeType: "image/jpeg",
      caption: "",
      fileSize: savedSize,
      width: metadata.width ?? 0,
      height: metadata.height ?? 0,
      exifData: exifJson,
      displayOrder: nextOrder++,
      uploadedAt: formatDatetime(),
    };

    db.insert(photos).values(photo).run();

    created.push({
      ...photo,
      url: `/api/images/originals/${originalFilename}`,
      thumbnailUrl: `/api/images/thumbnails/${thumbnailFilename}`,
    });
  }

  // Auto-set cover photo if album has none and we created photos
  if (!album.coverPhotoId && created.length > 0) {
    db.update(albums)
      .set({ coverPhotoId: created[0].id, updatedAt: formatDatetime() })
      .where(eq(albums.id, id))
      .run();
  }

  return NextResponse.json({ photos: created, skippedDupes }, { status: 201 });
}
