-- Custom SQL migration file, put your code below! --
-- Adds the `source` column to `transactions` (importer provenance, e.g. 'CMC Markets').
-- Same drift as 0008: schema.ts and push-built local DBs have it, but no generated
-- migration added it, so migrate-built DBs (prod, CI) lacked it — causing a 500 on
-- import confirm (INSERT ... source) while preview (no writes) succeeded. Nullable,
-- matching schema.ts text('source').
ALTER TABLE `transactions` ADD `source` text;
