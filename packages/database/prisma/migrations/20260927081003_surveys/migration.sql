-- CreateEnum
CREATE TYPE "SurveyEnforcement" AS ENUM ('REMIND', 'BANNER', 'BLOCK');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'SURVEY_DUE';
ALTER TYPE "NotificationType" ADD VALUE 'SURVEY_ALERT';

-- CreateTable
CREATE TABLE "Survey" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "questions" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "minRoleLevel" INTEGER NOT NULL DEFAULT 20,
    "maxRoleLevel" INTEGER,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "periodDays" INTEGER DEFAULT 14,
    "dueDays" INTEGER NOT NULL DEFAULT 3,
    "enforcement" "SurveyEnforcement" NOT NULL DEFAULT 'BANNER',
    "notifyOnStart" BOOLEAN NOT NULL DEFAULT true,
    "remindBeforeHours" INTEGER DEFAULT 24,
    "notifyOverdue" BOOLEAN NOT NULL DEFAULT true,
    "staffDigest" BOOLEAN NOT NULL DEFAULT true,
    "allowEdit" BOOLEAN NOT NULL DEFAULT false,
    "retentionDays" INTEGER NOT NULL DEFAULT 365,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyCompletion" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "userId" TEXT,
    "period" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyDispatch" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "period" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Survey_isActive_idx" ON "Survey"("isActive");

-- CreateIndex
CREATE INDEX "SurveyCompletion_surveyId_period_idx" ON "SurveyCompletion"("surveyId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyCompletion_surveyId_userId_period_key" ON "SurveyCompletion"("surveyId", "userId", "period");

-- CreateIndex
CREATE INDEX "SurveyResponse_surveyId_period_idx" ON "SurveyResponse"("surveyId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyResponse_surveyId_userId_period_key" ON "SurveyResponse"("surveyId", "userId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyDispatch_surveyId_period_kind_key" ON "SurveyDispatch"("surveyId", "period", "kind");

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyCompletion" ADD CONSTRAINT "SurveyCompletion_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyCompletion" ADD CONSTRAINT "SurveyCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyDispatch" ADD CONSTRAINT "SurveyDispatch_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
