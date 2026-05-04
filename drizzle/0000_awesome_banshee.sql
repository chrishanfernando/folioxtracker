CREATE TABLE `assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`symbol` text NOT NULL,
	`name` text NOT NULL,
	`display_ticker` text NOT NULL,
	`yahoo_symbol` text NOT NULL,
	`category` text NOT NULL,
	`platform` text,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `category_targets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category` text NOT NULL,
	`target_pct` real NOT NULL,
	`threshold` real DEFAULT 5 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `category_targets_category_unique` ON `category_targets` (`category`);--> statement-breakpoint
CREATE TABLE `prices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asset_id` integer NOT NULL,
	`date` text NOT NULL,
	`price_aud` real NOT NULL,
	`price_usd` real,
	`fx_rate` real,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `price_asset_date_idx` ON `prices` (`asset_id`,`date`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`password_hash` text NOT NULL,
	`email` text,
	`email_notifications` integer DEFAULT false,
	`last_price_fetch` text,
	`last_rebalance_check` text
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asset_id` integer NOT NULL,
	`date` text NOT NULL,
	`action` text NOT NULL,
	`quantity` real NOT NULL,
	`unit_price_local` real,
	`local_currency` text,
	`fx_rate` real,
	`unit_price_aud` real NOT NULL,
	`split_multiplier` real DEFAULT 1,
	`adjusted_qty` real NOT NULL,
	`total_aud` real NOT NULL,
	`comment` text,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
