ALTER TABLE `rankings` ADD `access_mode` text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE `rankings` ADD `password_hash` text;--> statement-breakpoint
ALTER TABLE `rankings` ADD `invite_token` text;--> statement-breakpoint
ALTER TABLE `rankings` ADD `access_token` text;