CREATE TABLE `research_sessions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `ownerUserId` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `mode` varchar(32) NOT NULL,
  `status` enum('CURRENT','PARTIAL','DATA_REQUIRED','UNVERIFIED','ERROR') NOT NULL DEFAULT 'CURRENT',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `research_sessions_pk` PRIMARY KEY(`id`)
);
CREATE INDEX `research_sessions_owner_idx` ON `research_sessions` (`ownerUserId`,`updatedAt`);
CREATE TABLE `research_messages` (
  `id` int AUTO_INCREMENT NOT NULL,
  `sessionId` int NOT NULL,
  `role` enum('user','assistant','system') NOT NULL,
  `content` text NOT NULL,
  `evidenceJson` json,
  `quantResultsJson` json,
  `sourcesJson` json,
  `assumptionsJson` json,
  `limitationsJson` json,
  `status` varchar(32) NOT NULL DEFAULT 'CURRENT',
  `model` varchar(128),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `research_messages_pk` PRIMARY KEY(`id`)
);
CREATE INDEX `research_messages_session_idx` ON `research_messages` (`sessionId`,`createdAt`);
CREATE TABLE `research_documents` (
  `id` int AUTO_INCREMENT NOT NULL,
  `ownerUserId` int NOT NULL,
  `filename` varchar(255) NOT NULL,
  `title` varchar(255),
  `mimeType` varchar(128) NOT NULL,
  `contentHash` varchar(128) NOT NULL,
  `storageKey` text,
  `status` enum('READY','PROCESSING','ERROR') NOT NULL DEFAULT 'PROCESSING',
  `metadata` json,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `research_documents_pk` PRIMARY KEY(`id`)
);
CREATE INDEX `research_documents_owner_idx` ON `research_documents` (`ownerUserId`,`createdAt`);
CREATE INDEX `research_documents_hash_idx` ON `research_documents` (`ownerUserId`,`contentHash`);
