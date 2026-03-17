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
CREATE INDEX `idx_pending_interactions_expires_at` ON `pending_interactions` (`expires_at`);