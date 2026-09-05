CREATE TABLE `account_lifecycle` (
	`member_id` text PRIMARY KEY NOT NULL,
	`household_id` text DEFAULT 'default' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`activated_at` text,
	`disabled_at` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `account_lifecycle` (`member_id`, `household_id`, `status`, `activated_at`, `updated_at`)
SELECT `id`, 'default', 'active', `created_at`, `created_at` FROM `members`;
--> statement-breakpoint
CREATE INDEX `idx_account_lifecycle_household_status` ON `account_lifecycle` (`household_id`,`status`);
--> statement-breakpoint
CREATE TABLE `auth_credentials` (
	`email` text PRIMARY KEY NOT NULL,
	`password_hash` text NOT NULL,
	`must_change_password` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `chores` ADD `started_at` text;
