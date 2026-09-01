ALTER TABLE `ballots` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `rankings` ADD `name_mode` text DEFAULT 'required' NOT NULL;--> statement-breakpoint
ALTER TABLE `rankings` ADD `one_vote_per_user` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `rankings` ADD `results_visibility` text DEFAULT 'always' NOT NULL;--> statement-breakpoint
ALTER TABLE `rankings` ADD `vote_pin_hash` text;--> statement-breakpoint
ALTER TABLE `rankings` ADD `vote_pin_token` text;