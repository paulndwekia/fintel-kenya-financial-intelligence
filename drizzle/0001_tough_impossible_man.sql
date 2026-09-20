CREATE TABLE `data_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`sourceType` varchar(64) NOT NULL,
	`endpoint` text,
	`status` enum('READY','DATA REQUIRED','ERROR') NOT NULL DEFAULT 'DATA REQUIRED',
	`lastUpdated` timestamp,
	`quality` varchar(32) DEFAULT 'UNKNOWN',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `data_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fx_rates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pair` varchar(16) NOT NULL,
	`rate` decimal(18,8),
	`asOf` timestamp,
	`sourceId` int,
	`quality` varchar(32),
	CONSTRAINT `fx_rates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `historical_prices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`instrument` varchar(128) NOT NULL,
	`price` decimal(18,8),
	`asOf` timestamp NOT NULL,
	`sourceId` int,
	`quality` varchar(32),
	CONSTRAINT `historical_prices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `market_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`instrument` varchar(128) NOT NULL,
	`assetClass` varchar(64) NOT NULL,
	`value` decimal(18,8),
	`unit` varchar(32),
	`sourceId` int,
	`asOf` timestamp,
	`quality` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `market_data_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `model_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`model` varchar(128) NOT NULL,
	`category` varchar(64) NOT NULL,
	`status` enum('READY','RUNNING','DATA REQUIRED','ERROR') NOT NULL DEFAULT 'READY',
	`inputJson` json,
	`outputJson` json,
	`dataSource` varchar(128),
	`lastRun` timestamp,
	CONSTRAINT `model_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portfolio_positions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`portfolioId` int NOT NULL,
	`instrument` varchar(128) NOT NULL,
	`assetClass` varchar(64) NOT NULL,
	`quantity` decimal(18,8),
	`marketValueKes` decimal(18,2),
	`duration` decimal(10,5),
	`volatility` decimal(10,5),
	CONSTRAINT `portfolio_positions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portfolios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`baseCurrency` varchar(8) DEFAULT 'KES',
	`valuationDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `portfolios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pricing_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`model` varchar(64) NOT NULL,
	`instrument` varchar(128),
	`inputJson` json,
	`outputJson` json,
	`calculatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pricing_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `risk_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`portfolioId` int NOT NULL,
	`method` varchar(64) NOT NULL,
	`confidence` decimal(6,4),
	`horizonDays` int,
	`varKes` decimal(18,2),
	`cvarKes` decimal(18,2),
	`stressJson` json,
	`calculatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `risk_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_status` (
	`id` int AUTO_INCREMENT NOT NULL,
	`service` varchar(128) NOT NULL,
	`status` varchar(32) NOT NULL,
	`message` text,
	`checkedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `system_status_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `treasury_bills` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenorDays` int NOT NULL,
	`auctionDate` timestamp,
	`weightedAverageRate` decimal(8,5),
	`acceptedAmountKes` decimal(18,2),
	`sourceId` int,
	`quality` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `treasury_bills_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `treasury_bonds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`securityCode` varchar(64) NOT NULL,
	`maturityDate` timestamp,
	`couponRate` decimal(8,5),
	`yieldToMaturity` decimal(8,5),
	`faceValueKes` decimal(18,2),
	`sourceId` int,
	`quality` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `treasury_bonds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `yield_curve` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenor` varchar(16) NOT NULL,
	`maturityYears` decimal(8,4) NOT NULL,
	`yieldRate` decimal(8,5),
	`curveDate` timestamp,
	`sourceId` int,
	`quality` varchar(32),
	CONSTRAINT `yield_curve_id` PRIMARY KEY(`id`)
);
