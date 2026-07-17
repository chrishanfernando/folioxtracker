CREATE TABLE `analytics_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`props` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `analytics_events_name_created_idx` ON `analytics_events` (`name`,`created_at`);--> statement-breakpoint
CREATE INDEX `analytics_events_user_idx` ON `analytics_events` (`user_id`);--> statement-breakpoint
ALTER TABLE `user_settings` ADD `analytics_opt_out` integer DEFAULT false NOT NULL;