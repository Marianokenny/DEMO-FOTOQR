-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "message" TEXT;

-- AlterTable
ALTER TABLE "ProjectionSettings" ADD COLUMN     "features" JSONB NOT NULL DEFAULT '{}';
