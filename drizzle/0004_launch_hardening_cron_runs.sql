CREATE TABLE `cron_runs` (
	`job_name` text PRIMARY KEY NOT NULL,
	`last_run_at` text NOT NULL,
	`last_status` text NOT NULL,
	`last_summary` text
);
--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `last_price_fetch`;--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `last_rebalance_check`;--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `last_email_poll`;