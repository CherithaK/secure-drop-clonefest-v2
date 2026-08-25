CREATE DATABASE IF NOT EXISTS `securedrop`;
--> statement-breakpoint
USE `securedrop`;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `users` (
  `id` int AUTO_INCREMENT NOT NULL,
  `openId` varchar(64) NOT NULL,
  `name` text,
  `email` varchar(320),
  `loginMethod` varchar(64),
  `role` enum('user','admin') NOT NULL DEFAULT 'user',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `users_id` PRIMARY KEY(`id`),
  CONSTRAINT `users_open_id_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `secure_drops` (
  `id` int AUTO_INCREMENT NOT NULL,
  `slug` varchar(24) NOT NULL,
  `ownerSessionHash` varchar(128) NOT NULL,
  `title` varchar(160) NOT NULL DEFAULT 'Untitled drop',
  `ciphertext` text,
  `iv` varchar(64),
  `authTag` varchar(64),
  `passphraseHash` varchar(256),
  `status` enum('ACTIVE','EXPIRED','REVOKED','DESTROYED') NOT NULL DEFAULT 'ACTIVE',
  `burnAfterReading` int NOT NULL DEFAULT 0,
  `viewLimit` int NOT NULL DEFAULT 1,
  `viewCount` int NOT NULL DEFAULT 0,
  `failedAttempts` int NOT NULL DEFAULT 0,
  `lockedUntil` timestamp NULL,
  `expiresAt` timestamp NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lastViewedAt` timestamp NULL,
  CONSTRAINT `secure_drops_id` PRIMARY KEY(`id`),
  CONSTRAINT `secure_drops_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE INDEX `secure_drops_owner_session_idx` ON `secure_drops` (`ownerSessionHash`);
--> statement-breakpoint
CREATE INDEX `secure_drops_lifecycle_idx` ON `secure_drops` (`status`,`expiresAt`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `secure_drop_events` (
  `id` int AUTO_INCREMENT NOT NULL,
  `ownerSessionHash` varchar(128) NOT NULL,
  `dropSlug` varchar(24) NOT NULL,
  `kind` enum('CREATED','OPENED','PASSPHRASE_REJECTED','REVOKED','EXPIRED','DESTROYED') NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `secure_drop_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `secure_drop_events_owner_session_idx` ON `secure_drop_events` (`ownerSessionHash`,`createdAt`);
--> statement-breakpoint
CREATE INDEX `secure_drop_events_drop_idx` ON `secure_drop_events` (`dropSlug`,`createdAt`);
