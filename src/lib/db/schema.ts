import { sqliteTable, text as sqliteText, integer as sqliteInteger, index as sqliteIndex } from "drizzle-orm/sqlite-core";
import { pgTable, text as pgText, integer as pgInteger, index as pgIndex } from "drizzle-orm/pg-core";
import { isPostgres } from "./config";

// ---------- SQLite schema ----------

const sqliteCategories = sqliteTable(
  "categories",
  {
    id: sqliteText("id").primaryKey(),
    name: sqliteText("name").notNull(),
    description: sqliteText("description").notNull().default(""),
    coverImagePath: sqliteText("cover_image_path"),
    displayOrder: sqliteInteger("display_order").notNull(),
    createdAt: sqliteText("created_at").notNull(),
    updatedAt: sqliteText("updated_at").notNull(),
  },
  (table) => [sqliteIndex("idx_category_display_order").on(table.displayOrder)]
);

const sqliteAlbums = sqliteTable(
  "albums",
  {
    id: sqliteText("id").primaryKey(), // 8-char short ID
    title: sqliteText("title").notNull(),
    date: sqliteText("date").notNull(),
    notes: sqliteText("notes").notNull().default(""), // Markdown string
    categoryId: sqliteText("category_id").references(() => sqliteCategories.id, { onDelete: "set null" }),
    displayOrder: sqliteInteger("display_order").notNull(),
    coverPhotoId: sqliteText("cover_photo_id"),
    password: sqliteText("password").notNull().default(""), // empty = no password
    isPrivate: sqliteInteger("is_private").notNull().default(0),
    allowDownload: sqliteInteger("allow_download").notNull().default(1),
    isProtected: sqliteInteger("is_protected").notNull().default(0),
    createdAt: sqliteText("created_at").notNull(),
    updatedAt: sqliteText("updated_at").notNull(),
  },
  (table) => [
    sqliteIndex("idx_album_date").on(table.date),
    sqliteIndex("idx_album_display_order").on(table.displayOrder),
  ]
);

const sqlitePhotos = sqliteTable(
  "photos",
  {
    id: sqliteText("id").primaryKey(),
    albumId: sqliteText("album_id")
      .notNull()
      .references(() => sqliteAlbums.id, { onDelete: "cascade" }),
    filename: sqliteText("filename").notNull(),
    filepath: sqliteText("filepath").notNull(),
    thumbnailPath: sqliteText("thumbnail_path").notNull(),
    contentHash: sqliteText("content_hash").notNull().default(""),
    blurDataUrl: sqliteText("blur_data_url").notNull(),
    mimeType: sqliteText("mime_type").notNull(),
    fileSize: sqliteInteger("file_size").notNull(),
    width: sqliteInteger("width").notNull(),
    height: sqliteInteger("height").notNull(),
    caption: sqliteText("caption").notNull().default(""),
    exifData: sqliteText("exif_data").notNull().default(""), // JSON string of EXIF metadata
    displayOrder: sqliteInteger("display_order").notNull(),
    uploadedAt: sqliteText("uploaded_at").notNull(),
  },
  (table) => [
    sqliteIndex("idx_photo_album_id").on(table.albumId),
    sqliteIndex("idx_photo_album_order").on(table.albumId, table.displayOrder),
  ]
);

const sqliteSiteSettings = sqliteTable("site_settings", {
  key: sqliteText("key").primaryKey(),
  value: sqliteText("value").notNull().default(""),
});

// ---------- PostgreSQL schema ----------

const pgCategories = pgTable(
  "categories",
  {
    id: pgText("id").primaryKey(),
    name: pgText("name").notNull(),
    description: pgText("description").notNull().default(""),
    coverImagePath: pgText("cover_image_path"),
    displayOrder: pgInteger("display_order").notNull(),
    createdAt: pgText("created_at").notNull(),
    updatedAt: pgText("updated_at").notNull(),
  },
  (table) => [pgIndex("idx_category_display_order").on(table.displayOrder)]
);

const pgAlbums = pgTable(
  "albums",
  {
    id: pgText("id").primaryKey(),
    title: pgText("title").notNull(),
    date: pgText("date").notNull(),
    notes: pgText("notes").notNull().default(""),
    categoryId: pgText("category_id").references(() => pgCategories.id, { onDelete: "set null" }),
    displayOrder: pgInteger("display_order").notNull(),
    coverPhotoId: pgText("cover_photo_id"),
    password: pgText("password").notNull().default(""),
    isPrivate: pgInteger("is_private").notNull().default(0),
    allowDownload: pgInteger("allow_download").notNull().default(1),
    isProtected: pgInteger("is_protected").notNull().default(0),
    createdAt: pgText("created_at").notNull(),
    updatedAt: pgText("updated_at").notNull(),
  },
  (table) => [
    pgIndex("idx_album_date").on(table.date),
    pgIndex("idx_album_display_order").on(table.displayOrder),
  ]
);

const pgPhotos = pgTable(
  "photos",
  {
    id: pgText("id").primaryKey(),
    albumId: pgText("album_id")
      .notNull()
      .references(() => pgAlbums.id, { onDelete: "cascade" }),
    filename: pgText("filename").notNull(),
    filepath: pgText("filepath").notNull(),
    thumbnailPath: pgText("thumbnail_path").notNull(),
    contentHash: pgText("content_hash").notNull().default(""),
    blurDataUrl: pgText("blur_data_url").notNull(),
    mimeType: pgText("mime_type").notNull(),
    fileSize: pgInteger("file_size").notNull(),
    width: pgInteger("width").notNull(),
    height: pgInteger("height").notNull(),
    caption: pgText("caption").notNull().default(""),
    exifData: pgText("exif_data").notNull().default(""),
    displayOrder: pgInteger("display_order").notNull(),
    uploadedAt: pgText("uploaded_at").notNull(),
  },
  (table) => [
    pgIndex("idx_photo_album_id").on(table.albumId),
    pgIndex("idx_photo_album_order").on(table.albumId, table.displayOrder),
  ]
);

const pgSiteSettings = pgTable("site_settings", {
  key: pgText("key").primaryKey(),
  value: pgText("value").notNull().default(""),
});

// ---------- Export the active schema based on DATABASE_URL ----------

export const categories = isPostgres ? pgCategories : sqliteCategories;
export const albums = isPostgres ? pgAlbums : sqliteAlbums;
export const photos = isPostgres ? pgPhotos : sqlitePhotos;
export const siteSettings = isPostgres ? pgSiteSettings : sqliteSiteSettings;

// Re-export both for drizzle-kit config
export const pg = { categories: pgCategories, albums: pgAlbums, photos: pgPhotos, siteSettings: pgSiteSettings };
export const sqlite = { categories: sqliteCategories, albums: sqliteAlbums, photos: sqlitePhotos, siteSettings: sqliteSiteSettings };
