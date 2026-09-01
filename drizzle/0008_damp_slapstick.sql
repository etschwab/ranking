CREATE TABLE `ranking_tiers` (
	`id` text PRIMARY KEY NOT NULL,
	`ranking_id` text NOT NULL,
	`label` text NOT NULL,
	`color` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`ranking_id`) REFERENCES `rankings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_ranking_tiers_position` ON `ranking_tiers` (`ranking_id`,`position`);--> statement-breakpoint
ALTER TABLE `items` ADD `image_data` text;--> statement-breakpoint
ALTER TABLE `scores` ADD `rank_position` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
INSERT INTO `ranking_tiers` (`id`, `ranking_id`, `label`, `color`, `position`)
SELECT lower(hex(randomblob(16))), `id`, 'S', '#ff8b72', 0 FROM `rankings`
UNION ALL SELECT lower(hex(randomblob(16))), `id`, 'A', '#ffc56f', 1 FROM `rankings`
UNION ALL SELECT lower(hex(randomblob(16))), `id`, 'B', '#fff1a8', 2 FROM `rankings`
UNION ALL SELECT lower(hex(randomblob(16))), `id`, 'C', '#80d6a8', 3 FROM `rankings`
UNION ALL SELECT lower(hex(randomblob(16))), `id`, 'D', '#8dc5ff', 4 FROM `rankings`;
