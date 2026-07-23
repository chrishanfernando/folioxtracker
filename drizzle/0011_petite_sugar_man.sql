CREATE TABLE `ticker_overrides` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`profile_id` integer NOT NULL,
	`source` text NOT NULL,
	`source_ticker` text NOT NULL,
	`symbol` text NOT NULL,
	`name` text NOT NULL,
	`display_ticker` text NOT NULL,
	`yahoo_symbol` text NOT NULL,
	`category` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ticker_overrides_profile_source_ticker_idx` ON `ticker_overrides` (`profile_id`,`source`,`source_ticker`);