ALTER TABLE `ingestion_runs` ADD COLUMN `duplicates` int DEFAULT 0 AFTER `recordsRejected`;
CREATE INDEX `ingestion_runs_status_source_idx` ON `ingestion_runs` (`status`, `sourceId`, `attemptedAt`);
CREATE INDEX `portfolio_positions_date_idx` ON `portfolio_positions` (`positionDate`);
