-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('site', 'email', 'phone', 'referral', 'manual');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('new', 'in_progress', 'qualified', 'disqualified', 'converted');

-- CreateEnum
CREATE TYPE "StageType" AS ENUM ('open', 'won', 'lost');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('note', 'task');

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "companyName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "source" "LeadSource" NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'new',
    "budget" DECIMAL(14,2),
    "venue" TEXT,
    "eventDate" DATE,
    "workFormat" TEXT,
    "comment" TEXT,
    "convertedAt" TIMESTAMP(3),
    "convertedAccountId" TEXT,
    "convertedContactId" TEXT,
    "convertedOpportunityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "website" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "city" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "accountId" TEXT,
    "position" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "contactId" TEXT,
    "stageId" TEXT NOT NULL,
    "amount" DECIMAL(14,2),
    "venue" TEXT,
    "eventDate" DATE,
    "workFormat" TEXT,
    "expectedCloseDate" DATE,
    "lostReason" TEXT,
    "closedAt" TIMESTAMP(3),
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stage" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "StageType" NOT NULL,

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "body" TEXT NOT NULL,
    "dueDate" DATE,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "leadId" TEXT,
    "accountId" TEXT,
    "contactId" TEXT,
    "opportunityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_source_idx" ON "Lead"("source");

-- CreateIndex
CREATE INDEX "Lead_convertedAccountId_idx" ON "Lead"("convertedAccountId");

-- CreateIndex
CREATE INDEX "Lead_convertedContactId_idx" ON "Lead"("convertedContactId");

-- CreateIndex
CREATE INDEX "Lead_convertedOpportunityId_idx" ON "Lead"("convertedOpportunityId");

-- CreateIndex
CREATE INDEX "Contact_accountId_idx" ON "Contact"("accountId");

-- CreateIndex
CREATE INDEX "Opportunity_accountId_idx" ON "Opportunity"("accountId");

-- CreateIndex
CREATE INDEX "Opportunity_contactId_idx" ON "Opportunity"("contactId");

-- CreateIndex
CREATE INDEX "Opportunity_stageId_idx" ON "Opportunity"("stageId");

-- CreateIndex
CREATE UNIQUE INDEX "Stage_key_key" ON "Stage"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Stage_order_key" ON "Stage"("order");

-- CreateIndex
CREATE INDEX "Activity_leadId_idx" ON "Activity"("leadId");

-- CreateIndex
CREATE INDEX "Activity_accountId_idx" ON "Activity"("accountId");

-- CreateIndex
CREATE INDEX "Activity_contactId_idx" ON "Activity"("contactId");

-- CreateIndex
CREATE INDEX "Activity_opportunityId_idx" ON "Activity"("opportunityId");

-- CreateIndex
CREATE INDEX "Activity_type_done_dueDate_idx" ON "Activity"("type", "done", "dueDate");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedAccountId_fkey" FOREIGN KEY ("convertedAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedContactId_fkey" FOREIGN KEY ("convertedContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedOpportunityId_fkey" FOREIGN KEY ("convertedOpportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Дописано вручную (Plan.md 1.4, 1.7). Prisma не описывает
-- CHECK-ограничения и данные справочников в schema.prisma.
-- ============================================================

-- Активность принадлежит ровно одной записи: лиду, компании, контакту или сделке.
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_exactly_one_parent_check"
    CHECK (num_nonnulls("leadId", "accountId", "contactId", "opportunityId") = 1);

-- Задача обязана иметь срок; у заметки срока нет и она не бывает выполненной.
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_type_fields_check"
    CHECK (
        ("type" = 'task' AND "dueDate" IS NOT NULL)
        OR ("type" = 'note' AND "dueDate" IS NULL AND "done" = false)
    );

-- Стадии воронки: справочник с постоянными id, seed их не трогает.
INSERT INTO "Stage" ("id", "key", "name", "order", "type") VALUES
    ('stage_brief',    'brief',    'Бриф',              1, 'open'),
    ('stage_concept',  'concept',  'Концепция и смета', 2, 'open'),
    ('stage_approval', 'approval', 'Согласование',      3, 'open'),
    ('stage_contract', 'contract', 'Договор',           4, 'open'),
    ('stage_won',      'won',      'Выиграна',          5, 'won'),
    ('stage_lost',     'lost',     'Проиграна',         6, 'lost');
