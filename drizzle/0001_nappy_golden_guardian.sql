CREATE TABLE `secure_drop_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerSessionHash` varchar(128) NOT NULL,
	`dropSlug` varchar(24) NOT NULL,
	`kind` enum('CREATED','OPENED','PASSPHRASE_REJECTED','REVOKED','EXPIRED','DESTROYED') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `secure_drop_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `secure_drop_events_owner_session_idx` ON `secure_drop_events` (`ownerSessionHash`,`createdAt`);--> statement-breakpoint
CREATE INDEX `secure_drop_events_drop_idx` ON `secure_drop_events` (`dropSlug`,`createdAt`);