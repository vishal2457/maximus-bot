CREATE INDEX IF NOT EXISTS `idx_jobs_status` ON `jobs` (`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_jobs_thread_id` ON `jobs` (`thread_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_jobs_created_at` ON `jobs` (`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_jobs_status_created` ON `jobs` (`status`,`created_at`);
