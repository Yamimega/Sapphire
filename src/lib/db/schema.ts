import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    coverImagePath: text("cover_image_path"),
    displayOrder: integer("display_order").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("idx_category_display_order").on(table.displayOrder)]
);

export const albums = sqliteTable(
  "albums",
  {
    id: text("id").primaryKey(), // 8-char short ID
    title: text("title").notNull(),
    date: text("date").notNull(),
    notes: text("notes").notNull().default(""), // Markdown string
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    displayOrder: integer("display_order").notNull(),
    coverPhotoId: text("cover_photo_id"),
    password: text("password").notNull().default(""), // empty = no password
    isPrivate: integer("is_private").notNull().default(0),
    allowDownload: integer("allow_download").notNull().default(1),
    isProtected: integer("is_protected").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_album_date").on(table.date),
    index("idx_album_display_order").on(table.displayOrder),
  ]
);

export const photos = sqliteTable(
  "photos",
  {
    id: text("id").primaryKey(),
    albumId: text("album_id")
      .notNull()
      .references(() => albums.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    filepath: text("filepath").notNull(),
    thumbnailPath: text("thumbnail_path").notNull(),
    contentHash: text("content_hash").notNull().default(""),
    blurDataUrl: text("blur_data_url").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSize: integer("file_size").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    caption: text("caption").notNull().default(""),
    exifData: text("exif_data").notNull().default(""), // JSON string of EXIF metadata
    displayOrder: integer("display_order").notNull(),
    uploadedAt: text("uploaded_at").notNull(),
  },
  (table) => [
    index("idx_photo_album_id").on(table.albumId),
    index("idx_photo_album_order").on(table.albumId, table.displayOrder),
  ]
);

export const siteSettings = sqliteTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
});
