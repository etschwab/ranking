CREATE INDEX `idx_ballots_ranking_created` ON `ballots` (`ranking_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_items_ranking_position` ON `items` (`ranking_id`,`position`);--> statement-breakpoint
CREATE INDEX `idx_scores_item` ON `scores` (`item_id`);