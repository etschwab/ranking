CREATE TABLE `user_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`email` text NOT NULL,
	`updated_at` integer NOT NULL
);
