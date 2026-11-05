CREATE TABLE `families` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'family' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `item_media` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`media_type` text NOT NULL,
	`label` text,
	`lang` text,
	`filename` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_item_media_item_order` ON `item_media` (`item_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `item_translations` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`lang` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`history` text,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_translations_item_lang_unique` ON `item_translations` (`item_id`,`lang`);--> statement-breakpoint
CREATE INDEX `idx_item_translations_item_lang` ON `item_translations` (`item_id`,`lang`);--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`country_code` text,
	`icon_slug` text,
	`is_published` integer DEFAULT false NOT NULL,
	`source_type` text DEFAULT 'system' NOT NULL,
	`owner_family_id` text,
	`recipe` text,
	`location_desc` text,
	`fun_facts` text,
	`audio_urls` text,
	`youtube_url` text,
	`trailer_url` text,
	`characters` text,
	`start_year` integer,
	`end_year` integer,
	`time_precision` text,
	`released_date` text,
	`rich_fields` text,
	`franchise_id` text,
	`quiz_required` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_items_published_category` ON `items` (`is_published`,`category`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_items_owner_created` ON `items` (`owner_family_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `profile_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`item_id` text NOT NULL,
	`category` text NOT NULL,
	`done_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_progress_profile_item_unique` ON `profile_progress` (`profile_id`,`item_id`);--> statement-breakpoint
CREATE INDEX `idx_profile_progress_profile_recent` ON `profile_progress` (`profile_id`,`done_at`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`name` text NOT NULL,
	`emoji` text NOT NULL,
	`color` text NOT NULL,
	`public_id` text NOT NULL,
	`native_country_code` text,
	`native_city` text,
	`avatar_type` text,
	`avatar_url` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_public_id_unique` ON `profiles` (`public_id`);--> statement-breakpoint
CREATE INDEX `idx_profiles_family_created` ON `profiles` (`family_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `quiz_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`item_id` text,
	`attempt_date` text NOT NULL,
	`score` integer NOT NULL,
	`total` integer NOT NULL,
	`answers` text NOT NULL,
	`completed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_quiz_attempts_profile_item` ON `quiz_attempts` (`profile_id`,`item_id`,`completed_at`);--> statement-breakpoint
CREATE TABLE `quiz_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`lang` text NOT NULL,
	`question` text NOT NULL,
	`question_type` text NOT NULL,
	`options` text NOT NULL,
	`correct_answers` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_quiz_questions_item_active` ON `quiz_questions` (`item_id`,`is_active`,`lang`,`sort_order`);