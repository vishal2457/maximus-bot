CREATE TABLE `pending_interactions` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`session_id` text,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reply` text,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`resolved_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_pending_interactions_job_id` ON `pending_interactions` (`job_id`);--> statement-breakpoint
CREATE INDEX `idx_pending_interactions_thread_id` ON `pending_interactions` (`thread_id`);--> statement-breakpoint
CREATE INDEX `idx_pending_interactions_status` ON `pending_interactions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_pending_interactions_expires_at` ON `pending_interactions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `channels` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'agent' NOT NULL,
	`system_prompt` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_channels_project_id` ON `channels` (`project_id`);--> statement-breakpoint
ALTER TABLE `projects` DROP COLUMN `discord_category_id`;--> statement-breakpoint
ALTER TABLE `projects` DROP COLUMN `development_channel_id`;