CREATE TABLE `channel_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`system_prompt` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_channel_configs_channel_id` ON `channel_configs` (`channel_id`);--> statement-breakpoint
CREATE INDEX `idx_channel_configs_project_id` ON `channel_configs` (`project_id`);--> statement-breakpoint
ALTER TABLE `jobs` ADD `system_prompt` text;