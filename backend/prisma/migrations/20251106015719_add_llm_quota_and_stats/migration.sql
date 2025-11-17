-- AlterTable
ALTER TABLE "llm_configs" ADD COLUMN     "code_analysis_model" VARCHAR(50),
ADD COLUMN     "hint_gen_model" VARCHAR(50),
ADD COLUMN     "last_reset_date" TIMESTAMP(3),
ADD COLUMN     "monthly_requests" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "monthly_token_quota" INTEGER,
ADD COLUMN     "monthly_tokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "problem_gen_model" VARCHAR(50),
ADD COLUMN     "quota_exceeded" BOOLEAN NOT NULL DEFAULT false;
