-- CreateEnum
CREATE TYPE "PhotoApprovalStatus" AS ENUM ('PENDING_PHOTOS', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "GradingCompany" AS ENUM ('PSA', 'BGS', 'CGC', 'SGC');

-- CreateEnum
CREATE TYPE "AuthenticatorApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_REVIEW', 'MORE_INFO_NEEDED', 'APPROVED', 'ONBOARDING', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'REVOKED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PHOTO_APPROVAL';

-- AlterEnum
ALTER TYPE "TradeLegStatus" ADD VALUE 'PHOTO_REVIEW';

-- DropForeignKey
ALTER TABLE "trade_legs" DROP CONSTRAINT "trade_legs_haveListingId_fkey";

-- DropForeignKey
ALTER TABLE "trade_legs" DROP CONSTRAINT "trade_legs_wantListingId_fkey";

-- DropIndex
DROP INDEX "card_variants_cardId_language_edition_key";

-- AlterTable
ALTER TABLE "authenticators" ADD COLUMN     "applicationStatus" "AuthenticatorApplicationStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "appliedAt" TIMESTAMP(3),
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "currentLoad" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "experienceDesc" TEXT,
ADD COLUMN     "insuranceBondAmount" INTEGER,
ADD COLUMN     "insuranceBondPaidAt" TIMESTAMP(3),
ADD COLUMN     "lastActiveAt" TIMESTAMP(3),
ADD COLUMN     "maxLoad" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "proofOfExpertise" TEXT[],
ADD COLUMN     "regionId" TEXT,
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspensionReason" TEXT;

-- AlterTable
ALTER TABLE "card_variants" ADD COLUMN     "rarity" TEXT,
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "treatment" TEXT,
ADD COLUMN     "version" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "language" SET DEFAULT 'EN',
ALTER COLUMN "edition" SET NOT NULL,
ALTER COLUMN "edition" SET DEFAULT '';

-- AlterTable
ALTER TABLE "cards" ADD COLUMN     "setId" TEXT;

-- AlterTable
ALTER TABLE "have_listings" ADD COLUMN     "autoAccept" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoAcceptMaxCycleLength" INTEGER,
ADD COLUMN     "autoAcceptMaxGap" INTEGER,
ADD COLUMN     "autoAcceptRegions" TEXT[];

-- AlterTable
ALTER TABLE "trade_legs" ADD COLUMN     "gradedHaveListingId" TEXT,
ADD COLUMN     "gradedWantListingId" TEXT,
ADD COLUMN     "isGraded" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "haveListingId" DROP NOT NULL,
ALTER COLUMN "wantListingId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "trades" ADD COLUMN     "participantIds" TEXT[];

-- AlterTable
ALTER TABLE "verification_assignments" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "isAudit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reserveAuthenticatorId" TEXT;

-- AlterTable
ALTER TABLE "want_listings" ADD COLUMN     "autoAccept" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoAcceptMaxCycleLength" INTEGER,
ADD COLUMN     "autoAcceptMaxGap" INTEGER,
ADD COLUMN     "autoAcceptRegions" TEXT[];

-- CreateTable
CREATE TABLE "regions" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_sets" (
    "id" TEXT NOT NULL,
    "tcg" "TCG" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productType" TEXT,
    "totalCards" INTEGER,
    "cardmarketId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graded_have_listings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "gradingCompany" "GradingCompany" NOT NULL,
    "grade" DOUBLE PRECISION NOT NULL,
    "certNumber" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'EN',
    "askPrice" INTEGER NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "autoAccept" BOOLEAN NOT NULL DEFAULT false,
    "autoAcceptMaxGap" INTEGER,
    "autoAcceptMaxCycleLength" INTEGER,
    "autoAcceptRegions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "graded_have_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graded_want_listings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "gradingCompany" "GradingCompany",
    "minGrade" DOUBLE PRECISION NOT NULL,
    "maxGrade" DOUBLE PRECISION,
    "language" TEXT,
    "bidPrice" INTEGER NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "autoAccept" BOOLEAN NOT NULL DEFAULT false,
    "autoAcceptMaxGap" INTEGER,
    "autoAcceptMaxCycleLength" INTEGER,
    "autoAcceptRegions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "graded_want_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_approvals" (
    "id" TEXT NOT NULL,
    "tradeLegId" TEXT NOT NULL,
    "status" "PhotoApprovalStatus" NOT NULL DEFAULT 'PENDING_PHOTOS',
    "photos" TEXT[],
    "rejectionNote" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "photo_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authenticator_inventory" (
    "id" TEXT NOT NULL,
    "authenticatorId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "condition" "Condition" NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'EN',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "askPrice" INTEGER NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "authenticator_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authenticator_audits" (
    "id" TEXT NOT NULL,
    "authenticatorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "authenticator_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authenticator_ratings" (
    "id" TEXT NOT NULL,
    "authenticatorId" TEXT NOT NULL,
    "tradeLegId" TEXT NOT NULL,
    "raterId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "accuracyScore" DOUBLE PRECISION,
    "speedScore" DOUBLE PRECISION,
    "satisfactionScore" DOUBLE PRECISION,
    "communicationScore" DOUBLE PRECISION,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "authenticator_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "regions_country_name_key" ON "regions"("country", "name");

-- CreateIndex
CREATE UNIQUE INDEX "card_sets_tcg_code_key" ON "card_sets"("tcg", "code");

-- CreateIndex
CREATE UNIQUE INDEX "graded_have_listings_certNumber_key" ON "graded_have_listings"("certNumber");

-- CreateIndex
CREATE INDEX "graded_have_listings_cardId_gradingCompany_grade_isActive_idx" ON "graded_have_listings"("cardId", "gradingCompany", "grade", "isActive");

-- CreateIndex
CREATE INDEX "graded_have_listings_userId_idx" ON "graded_have_listings"("userId");

-- CreateIndex
CREATE INDEX "graded_want_listings_cardId_isActive_idx" ON "graded_want_listings"("cardId", "isActive");

-- CreateIndex
CREATE INDEX "graded_want_listings_userId_idx" ON "graded_want_listings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "photo_approvals_tradeLegId_key" ON "photo_approvals"("tradeLegId");

-- CreateIndex
CREATE INDEX "authenticator_inventory_cardId_isAvailable_idx" ON "authenticator_inventory"("cardId", "isAvailable");

-- CreateIndex
CREATE INDEX "authenticator_inventory_authenticatorId_idx" ON "authenticator_inventory"("authenticatorId");

-- CreateIndex
CREATE INDEX "authenticator_audits_authenticatorId_type_idx" ON "authenticator_audits"("authenticatorId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "authenticator_ratings_tradeLegId_key" ON "authenticator_ratings"("tradeLegId");

-- CreateIndex
CREATE INDEX "authenticator_ratings_authenticatorId_createdAt_idx" ON "authenticator_ratings"("authenticatorId", "createdAt");

-- CreateIndex
CREATE INDEX "authenticators_regionId_isActive_idx" ON "authenticators"("regionId", "isActive");

-- CreateIndex
CREATE INDEX "authenticators_applicationStatus_idx" ON "authenticators"("applicationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "card_variants_cardId_language_edition_version_key" ON "card_variants"("cardId", "language", "edition", "version");

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_setId_fkey" FOREIGN KEY ("setId") REFERENCES "card_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graded_have_listings" ADD CONSTRAINT "graded_have_listings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graded_have_listings" ADD CONSTRAINT "graded_have_listings_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graded_want_listings" ADD CONSTRAINT "graded_want_listings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graded_want_listings" ADD CONSTRAINT "graded_want_listings_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_legs" ADD CONSTRAINT "trade_legs_haveListingId_fkey" FOREIGN KEY ("haveListingId") REFERENCES "have_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_legs" ADD CONSTRAINT "trade_legs_wantListingId_fkey" FOREIGN KEY ("wantListingId") REFERENCES "want_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_legs" ADD CONSTRAINT "trade_legs_gradedHaveListingId_fkey" FOREIGN KEY ("gradedHaveListingId") REFERENCES "graded_have_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_legs" ADD CONSTRAINT "trade_legs_gradedWantListingId_fkey" FOREIGN KEY ("gradedWantListingId") REFERENCES "graded_want_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_approvals" ADD CONSTRAINT "photo_approvals_tradeLegId_fkey" FOREIGN KEY ("tradeLegId") REFERENCES "trade_legs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authenticators" ADD CONSTRAINT "authenticators_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authenticator_inventory" ADD CONSTRAINT "authenticator_inventory_authenticatorId_fkey" FOREIGN KEY ("authenticatorId") REFERENCES "authenticators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authenticator_inventory" ADD CONSTRAINT "authenticator_inventory_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_assignments" ADD CONSTRAINT "verification_assignments_reserveAuthenticatorId_fkey" FOREIGN KEY ("reserveAuthenticatorId") REFERENCES "authenticators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authenticator_audits" ADD CONSTRAINT "authenticator_audits_authenticatorId_fkey" FOREIGN KEY ("authenticatorId") REFERENCES "authenticators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authenticator_ratings" ADD CONSTRAINT "authenticator_ratings_authenticatorId_fkey" FOREIGN KEY ("authenticatorId") REFERENCES "authenticators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
