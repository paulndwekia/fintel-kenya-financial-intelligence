-- FINTEL Phase 1: database integrity and query-performance hardening.
-- Apply only after running the duplicate preflight in scripts/check-database-integrity.ts.

CREATE UNIQUE INDEX `data_sources_name_unique` ON `data_sources` (`name`);
CREATE INDEX `data_sources_status_idx` ON `data_sources` (`status`);
CREATE INDEX `data_sources_schedule_idx` ON `data_sources` (`scheduleEnabled`, `nextScheduledAt`);

CREATE INDEX `ingestion_runs_source_idx` ON `ingestion_runs` (`sourceId`, `attemptedAt`);
CREATE INDEX `ingestion_runs_status_idx` ON `ingestion_runs` (`status`, `attemptedAt`);

CREATE UNIQUE INDEX `market_data_observation_unique` ON `market_data` (`instrument`, `observationDate`);
CREATE INDEX `market_data_observation_idx` ON `market_data` (`observationDate`, `assetClass`);
CREATE INDEX `market_data_source_idx` ON `market_data` (`sourceId`, `observationDate`);

CREATE UNIQUE INDEX `treasury_bills_observation_unique` ON `treasury_bills` (`tenorDays`, `auctionDate`);
CREATE INDEX `treasury_bills_auction_idx` ON `treasury_bills` (`auctionDate`, `tenorDays`);
CREATE INDEX `treasury_bills_source_idx` ON `treasury_bills` (`sourceId`, `auctionDate`);

CREATE UNIQUE INDEX `treasury_bonds_duplicate_key_unique` ON `treasury_bonds` (`duplicateKey`);
CREATE INDEX `treasury_bonds_security_idx` ON `treasury_bonds` (`securityCode`, `auctionDate`);
CREATE INDEX `treasury_bonds_auction_idx` ON `treasury_bonds` (`auctionDate`);
CREATE INDEX `treasury_bonds_source_idx` ON `treasury_bonds` (`sourceId`, `auctionDate`);

CREATE UNIQUE INDEX `fx_rates_observation_unique` ON `fx_rates` (`pair`, `observationDate`);
CREATE INDEX `fx_rates_observation_idx` ON `fx_rates` (`observationDate`, `pair`);
CREATE INDEX `fx_rates_source_idx` ON `fx_rates` (`sourceId`, `observationDate`);

CREATE UNIQUE INDEX `historical_prices_observation_unique` ON `historical_prices` (`instrument`, `observationDate`);
CREATE INDEX `historical_prices_series_idx` ON `historical_prices` (`instrument`, `observationDate`);
CREATE INDEX `historical_prices_source_idx` ON `historical_prices` (`sourceId`, `observationDate`);

CREATE UNIQUE INDEX `yield_curve_observation_unique` ON `yield_curve` (`tenor`, `curveDate`);
CREATE INDEX `yield_curve_date_idx` ON `yield_curve` (`curveDate`, `tenor`);
CREATE INDEX `yield_curve_source_idx` ON `yield_curve` (`sourceId`, `curveDate`);

CREATE INDEX `portfolios_owner_idx` ON `portfolios` (`ownerUserId`, `updatedAt`);
CREATE INDEX `portfolios_status_idx` ON `portfolios` (`status`, `updatedAt`);

CREATE INDEX `portfolio_positions_portfolio_idx` ON `portfolio_positions` (`portfolioId`, `positionDate`);
CREATE INDEX `portfolio_positions_instrument_idx` ON `portfolio_positions` (`instrumentId`, `positionDate`);

CREATE INDEX `risk_results_portfolio_idx` ON `risk_results` (`portfolioId`, `calculatedAt`);
CREATE INDEX `risk_results_method_idx` ON `risk_results` (`method`, `calculatedAt`);

CREATE INDEX `audit_logs_actor_idx` ON `audit_logs` (`actorUserId`, `createdAt`);
CREATE INDEX `audit_logs_resource_idx` ON `audit_logs` (`resourceType`, `resourceId`, `createdAt`);
