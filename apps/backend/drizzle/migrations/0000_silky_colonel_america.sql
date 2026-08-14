CREATE TABLE "checkpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_slug" text NOT NULL,
	"session_id" text NOT NULL,
	"checkpoint_name" text NOT NULL,
	"step_id" text,
	"context" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "checkpoints_experiment_slug_idx" ON "checkpoints" USING btree ("experiment_slug");--> statement-breakpoint
CREATE INDEX "checkpoints_session_id_idx" ON "checkpoints" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "checkpoints_created_at_idx" ON "checkpoints" USING btree ("created_at");