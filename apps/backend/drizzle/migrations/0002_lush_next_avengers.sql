DROP INDEX "experiments_experiment_slug_idx";--> statement-breakpoint
ALTER TABLE "experiments" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "experiments_experiment_slug_unique_idx" ON "experiments" USING btree ("experiment_slug");