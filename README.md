# Sapphire

A self-hosted photo gallery organizer built with Next.js. Organize photos into galleries and albums with drag-and-drop ordering, Markdown notes, photo captions, timeline view, and multi-language support.

## Features

- **Albums** — Group galleries into albums with cover images and Markdown descriptions
- **Gallery Management** — Create, edit, reorder, and delete galleries with drag-and-drop
- **Photo Uploads** — Bulk upload with automatic thumbnail generation and duplicate detection
- **Photo Captions** — Add captions to individual photos, displayed in the lightbox
- **Markdown Notes** — Write notes for galleries and album descriptions in Markdown
- **Timeline View** — Browse galleries chronologically, grouped by year and month
- **Lightbox** — Full-screen photo viewer with zoom, pan, EXIF metadata, captions, and keyboard navigation
- **Privacy Controls** — Mark galleries as private, password-protected, or download-restricted
- **Image Protection** — Multi-layer download prevention for non-downloadable galleries (canvas rendering, watermarking, encrypted delivery, tile fragmentation)
- **Signed Image URLs** — HMAC-signed URLs with configurable expiration prevent direct hotlinking
- **Backup & Restore** — Export/import all data as a zip archive
- **Multi-Language** — English, Chinese (中文), and Japanese (日本語)
- **Dark Mode** — System-aware theme switching
- **Responsive** — Works on desktop, tablet, and mobile

## Quick Start

### One-Line Install

```bash
curl -fsSL https://raw.githubusercontent.com/Yamimega/Sapphire/master/scripts/install.sh | bash
```

This clones the repo, installs dependencies, sets up the database, builds for production, and creates a default `.env` file. Then:

```bash
cd sapphire
nano .env        # set your admin password
npm start        # start on port 3000
```

### One-Line Update

Run from inside the sapphire directory:

```bash
curl -fsSL https://raw.githubusercontent.com/Yamimega/Sapphire/master/scripts/install.sh | bash -s -- --update
```

Options: `--dir=NAME` (directory name), `--port=PORT` (server port). Run with `--help` for details.

### Manual Install

Prerequisites: Node.js 20+, npm.

```bash
git clone https://github.com/Yamimega/Sapphire.git
cd Sapphire
npm install
npm run db:generate
npm run db:migrate
```

Create a `.env` file:

```env
SAPPHIRE_PASSWORD=your-secret-password
```

```bash
npm run build && npm start
```

Open [http://localhost:3000](http://localhost:3000).

> Without `SAPPHIRE_PASSWORD`, the app runs in **read-only mode** — visitors can browse but cannot upload, edit, or delete anything.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SAPPHIRE_PASSWORD` | *(none)* | Admin password. Without it the app is read-only. |
| `SAPPHIRE_WATERMARK_ENABLED` | `true` | Set to `false` to disable watermarking entirely. Other protection layers (canvas rendering, encrypted delivery, tile fragmentation) remain active. |
| `SAPPHIRE_WATERMARK_TEXT` | `PROTECTED` | Text overlaid on images in non-downloadable galleries for guests. |
| `SAPPHIRE_WATERMARK_OPACITY` | `0.3` | Watermark opacity (0.01–1). |
| `SAPPHIRE_WATERMARK_COLOR` | `white` | `white` or `black` — pick whichever contrasts with your photos. |
| `SAPPHIRE_WATERMARK_SIZE` | `0` | Font size in px. `0` = auto-scale based on image dimensions. |
| `SAPPHIRE_WATERMARK_SPACING` | `0` | Distance between repeated watermarks in px. `0` = auto. Only applies to `diagonal` and `cross` styles. |
| `SAPPHIRE_WATERMARK_STYLE` | `diagonal` | Watermark layout style (see below). |
| `SAPPHIRE_IMAGE_TOKEN_TTL` | `3600` | Signed image URL expiration in seconds. |

#### Watermark Styles

| Style | Description |
|---|---|
| `diagonal` | Repeating text tiled at -30° across the entire image. Best for strong coverage. |
| `center` | Single large text rotated -20° at the center. Minimal but visible. |
| `strip` | Semi-transparent bar at the bottom with centered text. Unobtrusive. |
| `corner` | Small text in the bottom-right corner. Least intrusive. |
| `cross` | Two diagonal lines of text forming an X pattern. Maximum coverage. |

## Usage Guide

### For Users

**Browsing** — Navigate galleries from the home page. Use the timeline view to browse by date. Switch languages or toggle dark mode from the header.

**Albums** — The Albums page groups galleries into categories. Click an album to see all galleries inside it.

**Lightbox** — Click any photo to open the full-screen viewer. Use arrow keys or swipe to navigate. Press `+`/`-` to zoom, `0` to reset, `F` to toggle fit/fill, `I` for info panel, `D` to download, `Esc` to close.

**Password-Protected Galleries** — Some galleries may require a password. Enter it once per session to unlock.

### For Admins

Log in with your `SAPPHIRE_PASSWORD` to unlock admin features:

**Galleries** — Click "Create Gallery" to add a new gallery. Click a gallery title to rename it. Drag galleries to reorder them. Use the settings panel to toggle privacy, download permissions, and password protection.

**Photos** — Click "Upload Photos" to bulk-upload images (JPEG, PNG, WebP, GIF up to 20MB each). Duplicates are detected automatically. From the photo menu, set a cover photo, edit the caption, or delete the photo.

**Albums** — Go to the Albums page and click "Create Album". Upload a cover image, write a Markdown description, and add galleries to the album. Remove galleries from an album without deleting them.

**Notes** — Each gallery has a notes section. Click "Edit" to write in Markdown — headings, bold, italic, lists, links, code blocks, and more are supported. Click "Done" to save and see the rendered output.

**Download Protection** — When a gallery has downloads disabled, guests see images rendered on a canvas with multiple protection layers. Admins can always download regardless of gallery settings.

**Backup** — Go to Settings > Backup & Restore to export all data (database + photos) as a zip file, or import from a previous backup.

## Image Protection

When a gallery has **Allow Download** turned off, Sapphire applies multiple layers to deter casual image saving by guests:

1. **Canvas Rendering** — Images are drawn on an HTML `<canvas>` element instead of a standard `<img>` tag, preventing right-click "Save Image As" and drag-to-desktop.
2. **Watermarking** — A configurable text watermark is composited into the image pixels server-side using sharp. The watermark is baked into the image data, not a CSS overlay.
3. **Encrypted Delivery** — Image bytes are XOR-obfuscated with a random key sent in a response header. The browser decrypts client-side before rendering. This prevents saving the raw response as a usable image file.
4. **Tile Fragmentation** — Full-size lightbox images are split into a 3×3 grid of tiles, each fetched separately and assembled on the canvas. No single network request contains the complete image.

Admins bypass all protection layers and can always download images directly.

> These measures deter casual saving but are not DRM. A determined user with developer tools can still extract images. The goal is to make it inconvenient enough to discourage the common case.

## Tech Stack

- [Next.js 16](https://nextjs.org/) (App Router)
- [SQLite](https://www.sqlite.org/) via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) + [Drizzle ORM](https://orm.drizzle.team/)
- [shadcn/ui](https://ui.shadcn.com/) (Radix primitives + Tailwind CSS v4)
- [sharp](https://sharp.pixelplumbing.com/) for image processing
- [@dnd-kit](https://dndkit.com/) for drag-and-drop

## Developer Guide

### Project Structure

```
src/
├── app/                    # Next.js App Router pages & API routes
│   ├── api/
│   │   ├── categories/     # Album CRUD, cover upload, gallery assignment
│   │   ├── gallery/        # Gallery CRUD, reorder
│   │   ├── photos/         # Photo delete, caption update
│   │   ├── timeline/       # Timeline data
│   │   ├── settings/       # Site settings
│   │   ├── backup/         # Export/import
│   │   ├── auth/           # Login/logout/status
│   │   ├── images/         # Serve uploaded images (+ protection, watermark, signed URLs)
│   │   └── favicon/        # Dynamic favicon
│   ├── albums/             # Albums list & detail pages
│   ├── gallery/[id]/       # Gallery detail page
│   ├── timeline/           # Timeline page
│   ├── settings/           # Settings page
│   └── login/              # Login page
├── components/             # React components
│   ├── ui/                 # shadcn/ui primitives
│   ├── gallery-card.tsx    # Gallery card (reused in home + album detail)
│   ├── gallery-grid.tsx    # Sortable gallery grid
│   ├── photo-grid.tsx      # Photo grid layout
│   ├── photo-tile.tsx      # Single photo with actions menu
│   ├── photo-lightbox.tsx  # Full-screen photo viewer (Radix Dialog)
│   ├── protected-image.tsx # Canvas-based image for non-downloadable galleries
│   ├── blob-image.tsx      # Blob-fetched <img> for normal galleries
│   ├── photo-upload.tsx    # Upload dropzone
│   ├── timeline-view.tsx   # Timeline entry component
│   └── rich-text-*.tsx     # Markdown editor (textarea) / viewer (renderer)
├── lib/
│   ├── db/                 # Database schema & connection
│   │   ├── schema.ts       # Drizzle schema (categories, albums, photos, siteSettings)
│   │   └── index.ts        # SQLite singleton + runtime migrations
│   ├── i18n/               # Translations (en, zh, ja)
│   ├── auth.ts             # Server-side auth (HMAC tokens)
│   ├── auth-context.tsx    # Client-side auth state
│   ├── constants.ts        # App constants (server-only, imports path)
│   ├── image-token.ts      # Signed image URLs + one-time download tokens
│   ├── plate-utils.ts      # Legacy Plate.js JSON → Markdown converter
│   ├── server-utils.ts     # Node.js utilities (server-only)
│   └── utils.ts            # Client-safe utilities (only cn())
├── types/                  # TypeScript interfaces
data/                       # Runtime data (gitignored)
├── database.db             # SQLite database
└── uploads/
    ├── originals/          # Full-size photos (normalized to JPEG)
    ├── thumbnails/         # WebP thumbnails (400px width)
    ├── covers/             # Album cover images (WebP)
    └── favicon/            # Custom site favicon
```

### Key Architecture Decisions

**Client/Server Split** — `src/lib/utils.ts` is client-safe (only exports `cn()`). All Node.js code lives in `server-utils.ts`, `constants.ts`, and `image-token.ts`. Never add Node.js imports to `utils.ts` — it is imported by every UI component.

**REST API** — No tRPC or server actions. All API routes use `NextRequest`/`NextResponse`. Auth is cookie-based HMAC tokens gated by `SAPPHIRE_PASSWORD`.

**Database** — SQLite with WAL mode. Schema changes go through Drizzle Kit migrations (`drizzle/`) and runtime column additions (`db/index.ts`). Booleans are stored as `integer` (0/1).

**Markdown** — Notes and descriptions are stored as plain Markdown text. A custom renderer in `rich-text-viewer.tsx` converts Markdown to HTML. No external Markdown library is used. Legacy Plate.js JSON content is auto-converted via `plate-utils.ts`.

**Images** — Uploaded photos are normalized to JPEG and stored in `data/uploads/originals/`. WebP thumbnails are generated at 400px width. Album covers are resized to 800px max. All images are served through `/api/images/[...path]` with HMAC-signed URLs, not Next.js static serving. Non-downloadable galleries apply watermarking, XOR encryption, and tile fragmentation for guest users.

**Downloads** — Downloads use a two-step flow: the client requests a one-time token (`POST /api/images/download-token`), then fetches the encrypted image via the token (`GET /api/images/download/{token}`). The client decrypts and triggers a blob download. This prevents direct URL sharing of downloadable files.

### Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier (semi, double quotes, 100 print width) |
| `npm run db:generate` | Generate Drizzle migrations from schema changes |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:studio` | Open Drizzle Studio (DB browser) |
| `npm run reset` | Delete all data (database + photos) and start fresh |
| `npm run backup` | create a zip archive at backups/sapphire-backup-YYYY-MM-DD-HHmmss.zip. |

### Adding a New Feature

1. Update the schema in `src/lib/db/schema.ts`
2. Run `npm run db:generate` to create a migration
3. Add runtime migration in `src/lib/db/index.ts` for backwards compatibility
4. Create API route(s) in `src/app/api/`
5. Update TypeScript types in `src/types/index.ts`
6. Add translation keys to all three language files in `src/lib/i18n/`
7. Build the UI in `src/components/` and page in `src/app/`

## License
GPL-3.0