CREATE TABLE `ingestion_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceId` int NOT NULL,
	`status` enum('RUNNING','CURRENT','STALE','BACKFILLING','ERROR') NOT NULL,
	`attemptedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`observationStart` timestamp,
	`observationEnd` timestamp,
	`recordsImported` int DEFAULT 0,
	`recordsRejected` int DEFAULT 0,
	`error` text,
	`metadata` json,
	CONSTRAINT `ingestion_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `data_sources` MODIFY COLUMN `status` enum('READY','LIVE','CURRENT','STALE','BACKFILLING','DATA REQUIRED','ERROR') NOT NULL DEFAULT 'DATA REQUIRED';--> statement-breakpoint
ALTER TABLE `data_sources` ADD `expectedFrequency` varchar(32);--> statement-breakpoint
ALTER TABLE `data_sources` ADD `latestObservation` timestamp;--> statement-breakpoint
ALTER TABLE `data_sources` ADD `recordsRejected` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `data_sources` ADD `progressPercent` decimal(6,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `data_sources` ADD `scheduleCronTaskUid` varchar(65);--> statement-breakpoint
ALTER TABLE `data_sources` ADD `scheduleEnabled` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `treasury_bonds` ADD `isin` varchar(32);--> statement-breakpoint
ALTER TABLE `treasury_bonds` ADD `auctionDate` timestamp;--> statement-breakpoint
ALTER TABLE `treasury_bonds` ADD `issueDate` timestamp;--> statement-breakpoint
ALTER TABLE `treasury_bonds` ADD `tenorYears` decimal(8,4);--> statement-breakpoint
ALTER TABLE `treasury_bonds` ADD `couponFrequency` varchar(32);--> statement-breakpoint
ALTER TABLE `treasury_bonds` ADD `pricePer100` decimal(12,6);--> statement-breakpoint
ALTER TABLE `treasury_bonds` ADD `weightedAverageYield` decimal(8,5);--> statement-breakpoint
ALTER TABLE `treasury_bonds` ADD `cutOffYield` decimal(8,5);--> statement-breakpoint
ALTER TABLE `treasury_bonds` ADD `amountOfferedKes` decimal(18,2);--> statement-breakpoint
ALTER TABLE `treasury_bonds` ADD `bidsReceivedKes` decimal(18,2);--> statement-breakpoint
ALTER TABLE `treasury_bonds` ADD `bidsAcceptedKes` decimal(18,2);--> statement-breakpoint
ALTER TABLE `treasury_bonds` ADD `amountAcceptedKes` decimal(18,2);--> statement-breakpoint
ALTER TABLE `treasury_bonds` ADD `documentUrl` text;--> statement-breakpoint
ALTER TABLE `treasury_bonds` ADD `duplicateKey` varchar(255);--> statement-breakpoint
ALTER TABLE `treasury_bonds` ADD `validationStatus` varchar(32);--> statement-breakpoint
ALTER TABLE `treasury_bonds` ADD `reviewReason` text;