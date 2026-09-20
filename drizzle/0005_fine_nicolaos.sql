CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int,
	`action` varchar(128) NOT NULL,
	`resourceType` varchar(64) NOT NULL,
	`resourceId` varchar(128),
	`result` varchar(32) NOT NULL,
	`requestId` varchar(128),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `instruments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`symbol` varchar(128) NOT NULL,
	`name` varchar(255) NOT NULL,
	`assetClass` varchar(64) NOT NULL,
	`currency` varchar(8),
	`securityCode` varchar(64),
	`isin` varchar(32),
	`sourceId` int,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `instruments_id` PRIMARY KEY(`id`),
	CONSTRAINT `instruments_symbol_unique` UNIQUE(`symbol`)
);
--> statement-breakpoint
ALTER TABLE `data_sources` ADD `nextScheduledAt` timestamp;--> statement-breakpoint
ALTER TABLE `data_sources` ADD `recordsInserted` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `data_sources` ADD `duplicates` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `data_sources` ADD `lastRunDurationMs` int;--> statement-breakpoint
ALTER TABLE `portfolio_positions` ADD `instrumentId` int;--> statement-breakpoint
ALTER TABLE `portfolio_positions` ADD `priceKes` decimal(18,8);--> statement-breakpoint
ALTER TABLE `portfolio_positions` ADD `currency` varchar(8) DEFAULT 'KES';--> statement-breakpoint
ALTER TABLE `portfolio_positions` ADD `positionDate` timestamp;--> statement-breakpoint
ALTER TABLE `portfolio_positions` ADD `metadata` json;--> statement-breakpoint
ALTER TABLE `portfolios` ADD `ownerUserId` int;--> statement-breakpoint
ALTER TABLE `portfolios` ADD `description` text;--> statement-breakpoint
ALTER TABLE `portfolios` ADD `status` enum('ACTIVE','ARCHIVED','DATA REQUIRED') DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE `portfolios` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `risk_results` ADD `lineageJson` json;