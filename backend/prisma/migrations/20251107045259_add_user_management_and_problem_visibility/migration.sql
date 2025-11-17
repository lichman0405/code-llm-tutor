-- AlterTable
ALTER TABLE "problems" ADD COLUMN     "creator_id" UUID,
ADD COLUMN     "is_public" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "password_reset_required" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "problems" ADD CONSTRAINT "problems_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
