CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`cover_image_path` text,
	`display_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_category_display_order` ON `categories` (`display_order`);--> statement-breakpoint
ALTER TABLE `albums` ADD `category_id` text REFERENCES categories(id);--> statement-breakpoint
ALTER TABLE `photos` ADD `caption` text DEFAULT '' NOT NULL;