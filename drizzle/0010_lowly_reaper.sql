CREATE INDEX `assets_profile_idx` ON `assets` (`profile_id`);--> statement-breakpoint
CREATE INDEX `transactions_asset_date_idx` ON `transactions` (`asset_id`,`date`);