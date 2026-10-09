-- Store CBK Treasury Bill source Issue Date independently from an auction date.
-- This avoids pairing a previous average rate with the future auction date from
-- the “Treasury Bills on Offer” page. Review/backup production before applying.
ALTER TABLE `treasury_bills` ADD COLUMN `issueDate` timestamp NULL AFTER `auctionDate`;
DROP INDEX `treasury_bills_observation_unique` ON `treasury_bills`;
CREATE UNIQUE INDEX `treasury_bills_observation_unique` ON `treasury_bills` (`tenorDays`, `issueDate`);
CREATE INDEX `treasury_bills_issue_date_idx` ON `treasury_bills` (`issueDate`, `tenorDays`);
