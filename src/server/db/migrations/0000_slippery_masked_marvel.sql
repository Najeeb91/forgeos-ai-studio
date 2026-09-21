CREATE TABLE "ai_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"level" varchar(50) NOT NULL,
	"stage" varchar(50) NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_run_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"detail" text NOT NULL,
	"stage" varchar(50) NOT NULL,
	"risk" varchar(50) NOT NULL,
	"status" varchar(50) NOT NULL,
	"order_idx" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"prompt" text NOT NULL,
	"provider" varchar(100) NOT NULL,
	"model" varchar(100) NOT NULL,
	"status" varchar(50) NOT NULL,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"step_id" uuid NOT NULL,
	"decision" varchar(50) NOT NULL,
	"actor" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"actor" varchar(50) NOT NULL,
	"actor_name" varchar(255) NOT NULL,
	"action" varchar(255) NOT NULL,
	"target" varchar(255) NOT NULL,
	"risk" varchar(50) NOT NULL,
	"approved" boolean,
	"diff_summary" text,
	"stage" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"env" varchar(50) NOT NULL,
	"status" varchar(50) NOT NULL,
	"commit_sha" varchar(255),
	"url" varchar(255) NOT NULL,
	"adapter" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"stage_id" varchar(50) NOT NULL,
	"label" varchar(100) NOT NULL,
	"status" varchar(50) NOT NULL,
	"summary" text NOT NULL,
	"progress" integer NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_brain_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"vision" text NOT NULL,
	"requirements" jsonb NOT NULL,
	"decisions" jsonb NOT NULL,
	"architecture" jsonb NOT NULL,
	"schema" jsonb NOT NULL,
	"integrations" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"tagline" text NOT NULL,
	"description" text NOT NULL,
	"status" varchar(50) NOT NULL,
	"health" varchar(50) NOT NULL,
	"owner" varchar(255) NOT NULL,
	"stack" jsonb NOT NULL,
	"benchmark" boolean DEFAULT false,
	"preview_route" varchar(255),
	"preview_status" varchar(50),
	"preview_last_built_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "source_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"path" text NOT NULL,
	"kind" varchar(50) NOT NULL,
	"language" varchar(50),
	"loc" integer,
	"status" varchar(50),
	"content" text
);
--> statement-breakpoint
CREATE TABLE "source_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"commit_sha" varchar(255),
	"message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_run_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"suite" varchar(50) NOT NULL,
	"status" varchar(50) NOT NULL,
	"duration_ms" integer NOT NULL,
	"detail" text
);
--> statement-breakpoint
CREATE TABLE "test_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"snapshot_id" uuid,
	"status" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_events" ADD CONSTRAINT "ai_events_run_id_ai_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_run_steps" ADD CONSTRAINT "ai_run_steps_run_id_ai_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_step_id_ai_run_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."ai_run_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_brain_versions" ADD CONSTRAINT "project_brain_versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_files" ADD CONSTRAINT "source_files_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_snapshots" ADD CONSTRAINT "source_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_test_run_id_test_runs_id_fk" FOREIGN KEY ("test_run_id") REFERENCES "public"."test_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_events_run_id_idx" ON "ai_events" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "ai_run_steps_run_id_idx" ON "ai_run_steps" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "ai_runs_project_id_idx" ON "ai_runs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "ai_runs_started_at_idx" ON "ai_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "approvals_step_id_idx" ON "approvals" USING btree ("step_id");--> statement-breakpoint
CREATE INDEX "audit_events_project_id_idx" ON "audit_events" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "audit_events_created_at_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "deployments_project_id_idx" ON "deployments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "deployments_created_at_idx" ON "deployments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "pipeline_stages_project_id_idx" ON "pipeline_stages" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_brain_versions_project_id_idx" ON "project_brain_versions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_brain_versions_created_at_idx" ON "project_brain_versions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "projects_slug_idx" ON "projects" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "projects_created_at_idx" ON "projects" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "source_files_snapshot_id_idx" ON "source_files" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "source_snapshots_project_id_idx" ON "source_snapshots" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "source_snapshots_created_at_idx" ON "source_snapshots" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "test_results_test_run_id_idx" ON "test_results" USING btree ("test_run_id");--> statement-breakpoint
CREATE INDEX "test_runs_project_id_idx" ON "test_runs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "test_runs_created_at_idx" ON "test_runs" USING btree ("created_at");