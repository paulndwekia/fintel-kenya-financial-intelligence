
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
DROP TABLE IF EXISTS `__drizzle_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `__drizzle_migrations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `hash` text NOT NULL,
  `created_at` bigint DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=1731837;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `actorUserId` int DEFAULT NULL,
  `action` varchar(128) NOT NULL,
  `resourceType` varchar(64) NOT NULL,
  `resourceId` varchar(128) DEFAULT NULL,
  `result` varchar(32) NOT NULL,
  `requestId` varchar(128) DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `data_sources`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `data_sources` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(128) NOT NULL,
  `sourceType` varchar(64) NOT NULL,
  `endpoint` text DEFAULT NULL,
  `status` enum('READY','LIVE','CURRENT','STALE','BACKFILLING','DATA REQUIRED','ERROR') NOT NULL DEFAULT 'DATA REQUIRED',
  `lastUpdated` timestamp NULL DEFAULT NULL,
  `quality` varchar(32) DEFAULT 'UNKNOWN',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lastAttemptedAt` timestamp NULL DEFAULT NULL,
  `lastSuccessfulUpdate` timestamp NULL DEFAULT NULL,
  `recordCount` int DEFAULT '0',
  `lastError` text DEFAULT NULL,
  `expectedFrequency` varchar(32) DEFAULT NULL,
  `latestObservation` timestamp NULL DEFAULT NULL,
  `recordsRejected` int DEFAULT '0',
  `progressPercent` decimal(6,2) DEFAULT '0',
  `scheduleCronTaskUid` varchar(65) DEFAULT NULL,
  `scheduleEnabled` tinyint(1) DEFAULT '0',
  `nextScheduledAt` timestamp NULL DEFAULT NULL,
  `recordsInserted` int DEFAULT '0',
  `duplicates` int DEFAULT '0',
  `lastRunDurationMs` int DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=120001;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `fx_rates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fx_rates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pair` varchar(16) NOT NULL,
  `rate` decimal(18,8) DEFAULT NULL,
  `asOf` timestamp NULL DEFAULT NULL,
  `sourceId` int DEFAULT NULL,
  `quality` varchar(32) DEFAULT NULL,
  `observationDate` timestamp NULL DEFAULT NULL,
  `publicationTimestamp` timestamp NULL DEFAULT NULL,
  `retrievalTimestamp` timestamp NULL DEFAULT NULL,
  `frequency` varchar(32) DEFAULT NULL,
  `currency` varchar(8) DEFAULT NULL,
  `sourceUrl` text DEFAULT NULL,
  `ingestionStatus` varchar(32) DEFAULT NULL,
  `rawValue` text DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `historical_prices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `historical_prices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `instrument` varchar(128) NOT NULL,
  `price` decimal(18,8) DEFAULT NULL,
  `asOf` timestamp NOT NULL,
  `sourceId` int DEFAULT NULL,
  `quality` varchar(32) DEFAULT NULL,
  `observationDate` timestamp NULL DEFAULT NULL,
  `publicationTimestamp` timestamp NULL DEFAULT NULL,
  `retrievalTimestamp` timestamp NULL DEFAULT NULL,
  `frequency` varchar(32) DEFAULT NULL,
  `currency` varchar(8) DEFAULT NULL,
  `sourceUrl` text DEFAULT NULL,
  `ingestionStatus` varchar(32) DEFAULT NULL,
  `rawValue` text DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=90001;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `ingestion_runs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ingestion_runs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sourceId` int NOT NULL,
  `status` enum('RUNNING','CURRENT','STALE','BACKFILLING','ERROR') NOT NULL,
  `attemptedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completedAt` timestamp NULL DEFAULT NULL,
  `observationStart` timestamp NULL DEFAULT NULL,
  `observationEnd` timestamp NULL DEFAULT NULL,
  `recordsImported` int DEFAULT '0',
  `recordsRejected` int DEFAULT '0',
  `error` text DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=150001;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `instruments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `instruments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `symbol` varchar(128) NOT NULL,
  `name` varchar(255) NOT NULL,
  `assetClass` varchar(64) NOT NULL,
  `currency` varchar(8) DEFAULT NULL,
  `securityCode` varchar(64) DEFAULT NULL,
  `isin` varchar(32) DEFAULT NULL,
  `sourceId` int DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `instruments_symbol_unique` (`symbol`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `market_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `market_data` (
  `id` int NOT NULL AUTO_INCREMENT,
  `instrument` varchar(128) NOT NULL,
  `assetClass` varchar(64) NOT NULL,
  `value` decimal(18,8) DEFAULT NULL,
  `unit` varchar(32) DEFAULT NULL,
  `sourceId` int DEFAULT NULL,
  `asOf` timestamp NULL DEFAULT NULL,
  `quality` varchar(32) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `observationDate` timestamp NULL DEFAULT NULL,
  `publicationTimestamp` timestamp NULL DEFAULT NULL,
  `retrievalTimestamp` timestamp NULL DEFAULT NULL,
  `frequency` varchar(32) DEFAULT NULL,
  `currency` varchar(8) DEFAULT NULL,
  `sourceUrl` text DEFAULT NULL,
  `ingestionStatus` varchar(32) DEFAULT NULL,
  `rawValue` text DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `model_runs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `model_runs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `model` varchar(128) NOT NULL,
  `category` varchar(64) NOT NULL,
  `status` enum('READY','RUNNING','DATA REQUIRED','ERROR') NOT NULL DEFAULT 'READY',
  `inputJson` json DEFAULT NULL,
  `outputJson` json DEFAULT NULL,
  `dataSource` varchar(128) DEFAULT NULL,
  `lastRun` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `portfolio_positions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `portfolio_positions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `portfolioId` int NOT NULL,
  `instrument` varchar(128) NOT NULL,
  `assetClass` varchar(64) NOT NULL,
  `quantity` decimal(18,8) DEFAULT NULL,
  `marketValueKes` decimal(18,2) DEFAULT NULL,
  `duration` decimal(10,5) DEFAULT NULL,
  `volatility` decimal(10,5) DEFAULT NULL,
  `instrumentId` int DEFAULT NULL,
  `priceKes` decimal(18,8) DEFAULT NULL,
  `currency` varchar(8) DEFAULT 'KES',
  `positionDate` timestamp NULL DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `portfolios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `portfolios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(128) NOT NULL,
  `baseCurrency` varchar(8) DEFAULT 'KES',
  `valuationDate` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ownerUserId` int DEFAULT NULL,
  `description` text DEFAULT NULL,
  `status` enum('ACTIVE','ARCHIVED','DATA REQUIRED') NOT NULL DEFAULT 'ACTIVE',
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `pricing_results`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pricing_results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `model` varchar(64) NOT NULL,
  `instrument` varchar(128) DEFAULT NULL,
  `inputJson` json DEFAULT NULL,
  `outputJson` json DEFAULT NULL,
  `calculatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `risk_results`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `risk_results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `portfolioId` int NOT NULL,
  `method` varchar(64) NOT NULL,
  `confidence` decimal(6,4) DEFAULT NULL,
  `horizonDays` int DEFAULT NULL,
  `varKes` decimal(18,2) DEFAULT NULL,
  `cvarKes` decimal(18,2) DEFAULT NULL,
  `stressJson` json DEFAULT NULL,
  `calculatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `system_status`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_status` (
  `id` int NOT NULL AUTO_INCREMENT,
  `service` varchar(128) NOT NULL,
  `status` varchar(32) NOT NULL,
  `message` text DEFAULT NULL,
  `checkedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `treasury_bills`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `treasury_bills` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenorDays` int NOT NULL,
  `auctionDate` timestamp NULL DEFAULT NULL,
  `weightedAverageRate` decimal(8,5) DEFAULT NULL,
  `acceptedAmountKes` decimal(18,2) DEFAULT NULL,
  `sourceId` int DEFAULT NULL,
  `quality` varchar(32) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `observationDate` timestamp NULL DEFAULT NULL,
  `publicationTimestamp` timestamp NULL DEFAULT NULL,
  `retrievalTimestamp` timestamp NULL DEFAULT NULL,
  `frequency` varchar(32) DEFAULT NULL,
  `currency` varchar(8) DEFAULT NULL,
  `sourceUrl` text DEFAULT NULL,
  `ingestionStatus` varchar(32) DEFAULT NULL,
  `rawValue` text DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `treasury_bonds`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `treasury_bonds` (
  `id` int NOT NULL AUTO_INCREMENT,
  `securityCode` varchar(64) NOT NULL,
  `maturityDate` datetime DEFAULT NULL,
  `couponRate` decimal(8,5) DEFAULT NULL,
  `yieldToMaturity` decimal(8,5) DEFAULT NULL,
  `faceValueKes` decimal(18,2) DEFAULT NULL,
  `sourceId` int DEFAULT NULL,
  `quality` varchar(32) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `observationDate` timestamp NULL DEFAULT NULL,
  `publicationTimestamp` timestamp NULL DEFAULT NULL,
  `retrievalTimestamp` timestamp NULL DEFAULT NULL,
  `frequency` varchar(32) DEFAULT NULL,
  `currency` varchar(8) DEFAULT NULL,
  `sourceUrl` text DEFAULT NULL,
  `ingestionStatus` varchar(32) DEFAULT NULL,
  `rawValue` text DEFAULT NULL,
  `isin` varchar(32) DEFAULT NULL,
  `auctionDate` timestamp NULL DEFAULT NULL,
  `issueDate` timestamp NULL DEFAULT NULL,
  `tenorYears` decimal(8,4) DEFAULT NULL,
  `couponFrequency` varchar(32) DEFAULT NULL,
  `pricePer100` decimal(12,6) DEFAULT NULL,
  `weightedAverageYield` decimal(8,5) DEFAULT NULL,
  `cutOffYield` decimal(8,5) DEFAULT NULL,
  `amountOfferedKes` decimal(18,2) DEFAULT NULL,
  `bidsReceivedKes` decimal(18,2) DEFAULT NULL,
  `bidsAcceptedKes` decimal(18,2) DEFAULT NULL,
  `amountAcceptedKes` decimal(18,2) DEFAULT NULL,
  `documentUrl` text DEFAULT NULL,
  `duplicateKey` varchar(255) DEFAULT NULL,
  `validationStatus` varchar(32) DEFAULT NULL,
  `reviewReason` text DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `openId` varchar(64) NOT NULL,
  `name` text DEFAULT NULL,
  `email` varchar(320) DEFAULT NULL,
  `loginMethod` varchar(64) DEFAULT NULL,
  `role` enum('user','admin','analyst','client','viewer') NOT NULL DEFAULT 'user',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `users_openId_unique` (`openId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=1410001;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `yield_curve`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `yield_curve` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenor` varchar(16) NOT NULL,
  `maturityYears` decimal(8,4) NOT NULL,
  `yieldRate` decimal(8,5) DEFAULT NULL,
  `curveDate` timestamp NULL DEFAULT NULL,
  `sourceId` int DEFAULT NULL,
  `quality` varchar(32) DEFAULT NULL,
  `observationDate` timestamp NULL DEFAULT NULL,
  `publicationTimestamp` timestamp NULL DEFAULT NULL,
  `retrievalTimestamp` timestamp NULL DEFAULT NULL,
  `frequency` varchar(32) DEFAULT NULL,
  `currency` varchar(8) DEFAULT NULL,
  `sourceUrl` text DEFAULT NULL,
  `ingestionStatus` varchar(32) DEFAULT NULL,
  `rawValue` text DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

