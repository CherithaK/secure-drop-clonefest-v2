CREATE TABLE `secure_drops` (
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
	`lockedUntil` timestamp,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastViewedAt` timestamp,
	CONSTRAINT `secure_drops_id` PRIMARY KEY(`id`),
	CONSTRAINT `secure_drops_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE INDEX `secure_drops_owner_session_idx` ON `secure_drops` (`ownerSessionHash`);--> statement-breakpoint
CREATE INDEX `secure_drops_lifecycle_idx` ON `secure_drops` (`status`,`expiresAt`);