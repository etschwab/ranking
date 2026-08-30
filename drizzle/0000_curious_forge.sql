CREATE TABLE `ballots` (
	`id` text PRIMARY KEY NOT NULL,
	`ranking_id` text NOT NULL,
	`voter_name` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`ranking_id`) REFERENCES `rankings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`ranking_id` text NOT NULL,
	`label` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`ranking_id`) REFERENCES `rankings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rankings` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rankings_slug_unique` ON `rankings` (`slug`);--> statement-breakpoint
CREATE TABLE `scores` (
	`ballot_id` text NOT NULL,
	`item_id` text NOT NULL,
	`tier` integer NOT NULL,
	PRIMARY KEY(`ballot_id`, `item_id`),
	FOREIGN KEY (`ballot_id`) REFERENCES `ballots`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
