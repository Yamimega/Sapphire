export interface Category {
  id: string;
  name: string;
  description: string;
  coverImagePath: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryWithMeta extends Category {
  galleryCount: number;
  coverImageUrl: string | null;
}

export interface Gallery {
  id: string;
  title: string;
  date: string;
  notes: string;
  categoryId: string | null;
  displayOrder: number;
  coverPhotoId: string | null;
  password: string;
  isPrivate: number;
  allowDownload: number;
  isProtected: number;
  createdAt: string;
  updatedAt: string;
}

export interface GalleryWithMeta extends Gallery {
  photoCount: number;
  coverThumbnailUrl: string | null;
}

export interface Photo {
  id: string;
  albumId: string;
  filename: string;
  filepath: string;
  thumbnailPath: string;
  contentHash: string;
  blurDataUrl: string;
  mimeType: string;
  fileSize: number;
  width: number;
  height: number;
  caption: string;
  exifData: string; // JSON string of EXIF metadata
  displayOrder: number;
  uploadedAt: string;
}

export interface ExifInfo {
  cameraMake?: string;
  cameraModel?: string;
  lens?: string;
  focalLength?: string;
  aperture?: string;
  shutterSpeed?: string;
  iso?: number;
  dateTaken?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  software?: string;
  orientation?: number;
}

export interface PhotoWithUrls extends Photo {
  url: string;
  thumbnailUrl: string;
}

export interface TimelineEntry {
  date: string;
  galleries: TimelineGallery[];
}

export interface TimelineGallery {
  id: string;
  title: string;
  photoCount: number;
  coverThumbnailUrl: string | null;
  thumbnails: string[];
}

export interface SiteSetting {
  key: string;
  value: string;
}

export interface ApiError {
  error: string;
}
