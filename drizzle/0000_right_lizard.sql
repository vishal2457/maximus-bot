CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`folder` text NOT NULL,
	`discord_category_id` text,
	`development_channel_id` text,
	`linear_issues_channel_id` text,
	`linear_project_id` text,
	`linear_project_name` text
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`session_id` text,
	`prompt` text NOT NULL,
	`author_tag` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`result` text,
	`error` text,
	`duration` integer,
	`platform` text DEFAULT 'discord' NOT NULL,
	`platform_thread_id` text,
	`sdk_type` text DEFAULT 'opencode' NOT NULL,
	`worker_id` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`completed_at` integer
);
--> statement-breakpoint
CREATE TABLE `cron_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`cron_expression` text NOT NULL,
	`prompt` text NOT NULL,
	`author_tag` text NOT NULL,
	`channel_id` text,
	`thread_id` text,
	`sdk_type` text DEFAULT 'opencode' NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`last_run_at` integer,
	`next_run_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
