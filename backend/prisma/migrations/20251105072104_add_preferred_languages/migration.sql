-- CreateEnum
CREATE TYPE "LearningGoal" AS ENUM ('interview', 'interest', 'competition');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('accepted', 'wrong_answer', 'time_limit_exceeded', 'runtime_error', 'compilation_error');

-- CreateEnum
CREATE TYPE "LLMProvider" AS ENUM ('openai', 'anthropic', 'custom');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "current_level" INTEGER NOT NULL DEFAULT 1,
    "learning_goal" "LearningGoal",
    "warmup_completed" BOOLEAN NOT NULL DEFAULT false,
    "warmup_data" JSONB NOT NULL DEFAULT '{}',
    "algorithm_proficiency" JSONB NOT NULL DEFAULT '{}',
    "preferred_languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "total_problems_solved" INTEGER NOT NULL DEFAULT 0,
    "total_submissions" INTEGER NOT NULL DEFAULT 0,
    "average_score" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "learning_velocity" DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    "recent_scores" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problems" (
    "id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "algorithm_types" TEXT[],
    "time_limit" INTEGER NOT NULL DEFAULT 2000,
    "memory_limit" INTEGER NOT NULL DEFAULT 256,
    "expected_complexity" VARCHAR(50),
    "examples" JSONB NOT NULL,
    "test_cases" JSONB NOT NULL,
    "standard_solutions" JSONB NOT NULL,
    "generated_by" VARCHAR(50),
    "generation_prompt" TEXT,
    "total_attempts" INTEGER NOT NULL DEFAULT 0,
    "total_solved" INTEGER NOT NULL DEFAULT 0,
    "average_score" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "problem_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "language" VARCHAR(20) NOT NULL,
    "status" "SubmissionStatus" NOT NULL,
    "test_results" JSONB,
    "passed_cases" INTEGER NOT NULL DEFAULT 0,
    "total_cases" INTEGER NOT NULL DEFAULT 0,
    "execution_time" INTEGER,
    "memory_used" DECIMAL(10,2),
    "score" DECIMAL(5,2),
    "correctness_score" DECIMAL(5,2),
    "time_score" DECIMAL(5,2),
    "hint_penalty" DECIMAL(5,2),
    "quality_score" DECIMAL(5,2),
    "hints_used" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "complexity_analysis" JSONB,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hints" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "problem_id" UUID NOT NULL,
    "submission_id" UUID,
    "hint_level" INTEGER NOT NULL,
    "hint_content" TEXT NOT NULL,
    "user_code_snapshot" TEXT,
    "generated_by" VARCHAR(50),
    "generation_time" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_configs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "LLMProvider" NOT NULL DEFAULT 'openai',
    "api_key_encrypted" TEXT,
    "model" VARCHAR(50),
    "base_url" TEXT,
    "custom_headers" JSONB,
    "total_requests" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warmup_conversations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "messages" JSONB NOT NULL,
    "assessment" JSONB,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "warmup_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "llm_configs_user_id_key" ON "llm_configs"("user_id");

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hints" ADD CONSTRAINT "hints_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hints" ADD CONSTRAINT "hints_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hints" ADD CONSTRAINT "hints_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_configs" ADD CONSTRAINT "llm_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warmup_conversations" ADD CONSTRAINT "warmup_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
