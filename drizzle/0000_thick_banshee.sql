CREATE TABLE `albums` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`date` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`display_order` integer NOT NULL,
	`cover_photo_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_album_date` ON `albums` (`date`);--> statement-breakpoint
CREATE INDEX `idx_album_display_order` ON `albums` (`display_order`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`album_id` text NOT NULL,
	`filename` text NOT NULL,
	`filepath` text NOT NULL,
	`thumbnail_path` text NOT NULL,
	`blur_data_url` text NOT NULL,
	`mime_type` text NOT NULL,
	`file_size` integer NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`display_order` integer NOT NULL,
	`uploaded_at` text NOT NULL,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_photo_album_id` ON `photos` (`album_id`);--> statement-breakpoint
CREATE INDEX `idx_photo_album_order` ON `photos` (`album_id`,`display_order`);