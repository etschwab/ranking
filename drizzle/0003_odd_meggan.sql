CREATE TABLE `ballot_edit_tokens` (
	`ballot_id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	FOREIGN KEY (`ballot_id`) REFERENCES `ballots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ballot_edit_tokens_token_unique` ON `ballot_edit_tokens` (`token`);