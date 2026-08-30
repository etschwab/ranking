CREATE TABLE `ranking_owners` (
	`ranking_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	FOREIGN KEY (`ranking_id`) REFERENCES `rankings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_ranking_owners_user` ON `ranking_owners` (`user_id`);