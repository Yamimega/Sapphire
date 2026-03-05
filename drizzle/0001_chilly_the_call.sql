CREATE TABLE `site_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE `albums` ADD `password` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `albums` ADD `is_private` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `albums` ADD `allow_download` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `albums` ADD `is_protected` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `photos` ADD `content_hash` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `photos` ADD `exif_data` text DEFAULT '' NOT NULL;