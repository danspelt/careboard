CREATE TABLE `activity` (
	`id` text PRIMARY KEY NOT NULL,
	`chore_id` text,
	`member_id` text NOT NULL,
	`action` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`chore_id`) REFERENCES `chores`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_activity_created_at` ON `activity` (`created_at`);--> statement-breakpoint
CREATE TABLE `chores` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`area` text NOT NULL,
	`due_date` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_by` text NOT NULL,
	`assigned_to` text,
	`completed_by` text,
	`created_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`created_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_to`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`completed_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_chores_status_due_date` ON `chores` (`status`,`due_date`);--> statement-breakpoint
CREATE INDEX `idx_chores_assigned_to_status` ON `chores` (`assigned_to`,`status`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'worker' NOT NULL,
	`color` text NOT NULL,
	`created_at` text NOT NULL
);
