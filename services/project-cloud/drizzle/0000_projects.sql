CREATE TABLE `projects` (
  `owner` text NOT NULL, `id` text NOT NULL, `name` text NOT NULL,
  `content` text NOT NULL, `etag` text NOT NULL, `updated_at` text NOT NULL,
  `mutation_id` text NOT NULL, PRIMARY KEY (`owner`, `id`)
);
--> statement-breakpoint
CREATE TABLE `shares` (
  `owner` text NOT NULL, `project_id` text NOT NULL, `public_id` text NOT NULL,
  `snapshot` text NOT NULL, PRIMARY KEY (`owner`, `project_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shares_public_id_unique` ON `shares` (`public_id`);
--> statement-breakpoint
CREATE TABLE `sessions` (
  `token_hash` text PRIMARY KEY NOT NULL, `owner` text NOT NULL,
  `email` text NOT NULL, `expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pairings` (
  `device_hash` text PRIMARY KEY NOT NULL, `user_code` text NOT NULL,
  `expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pairings_user_code_unique` ON `pairings` (`user_code`);
--> statement-breakpoint
CREATE TABLE `pair_limits` (
  `id` text PRIMARY KEY NOT NULL, `count` integer NOT NULL, `expires_at` integer NOT NULL
);
