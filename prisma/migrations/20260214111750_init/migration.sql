-- CreateEnum
CREATE TYPE "TCG" AS ENUM ('POKEMON', 'ONEPIECE', 'YUGIOH', 'MTG');

-- CreateEnum
CREATE TYPE "Condition" AS ENUM ('NM', 'LP', 'MP', 'HP', 'DMG');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'ESCROWED', 'CARDS_SUBMITTED', 'AUTHENTICATING', 'VERIFIED', 'DELIVERING', 'DELIVERED', 'COMPLETED', 'REJECTED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "TradeLegStatus" AS ENUM ('PENDING', 'CARD_RECEIVED', 'AUTHENTICATING', 'VERIFIED', 'SHIPPED', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "AuthenticatorTier" AS ENUM ('STANDARD', 'VERIFIED', 'PREMIUM');

-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('HELD', 'RELEASED', 'REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "EscrowEntryType" AS ENUM ('HOLD', 'RELEASE', 'REFUND');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED_BUYER', 'RESOLVED_SELLER', 'ESCALATED', 'CLOSED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TRADE_PROPOSED', 'TRADE_ACCEPTED', 'TRADE_UPDATE', 'MATCH_FOUND', 'VERIFICATION_COMPLETE', 'DISPUTE_UPDATE', 'SYSTEM');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "region" TEXT,
    "country" TEXT,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "cards" (
    "id" TEXT NOT NULL,
    "tcg" "TCG" NOT NULL,
    "name" TEXT NOT NULL,
    "setName" TEXT NOT NULL,
    "setCode" TEXT,
    "number" TEXT,
    "rarity" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_variants" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "edition" TEXT,
    "imageUrl" TEXT,

    CONSTRAINT "card_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "have_listings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "condition" "Condition" NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'EN',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "have_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "want_listings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "minCondition" "Condition" NOT NULL DEFAULT 'LP',
    "language" TEXT,
    "maxQuantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "want_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_proposals" (
    "id" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "cycleLength" INTEGER NOT NULL,
    "regions" TEXT[],
    "isViable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_proposal_legs" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,

    CONSTRAINT "match_proposal_legs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "status" "TradeStatus" NOT NULL DEFAULT 'PROPOSED',
    "statusHistory" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_legs" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "haveListingId" TEXT NOT NULL,
    "wantListingId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "status" "TradeLegStatus" NOT NULL DEFAULT 'PENDING',
    "authenticatorId" TEXT,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trade_legs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authenticators" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessName" TEXT,
    "tier" "AuthenticatorTier" NOT NULL DEFAULT 'STANDARD',
    "region" TEXT NOT NULL,
    "tcgExpertise" "TCG"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "totalVerified" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "authenticators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_assignments" (
    "id" TEXT NOT NULL,
    "tradeLegId" TEXT NOT NULL,
    "authenticatorId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "result" JSONB,
    "photos" TEXT[],

    CONSTRAINT "verification_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrows" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "status" "EscrowStatus" NOT NULL DEFAULT 'HELD',
    "totalAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escrows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_entries" (
    "id" TEXT NOT NULL,
    "escrowId" TEXT NOT NULL,
    "type" "EscrowEntryType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escrow_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "raisedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" TEXT[],
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE INDEX "cards_tcg_name_idx" ON "cards"("tcg", "name");

-- CreateIndex
CREATE UNIQUE INDEX "cards_tcg_setName_number_key" ON "cards"("tcg", "setName", "number");

-- CreateIndex
CREATE UNIQUE INDEX "card_variants_cardId_language_edition_key" ON "card_variants"("cardId", "language", "edition");

-- CreateIndex
CREATE INDEX "have_listings_cardId_condition_isActive_idx" ON "have_listings"("cardId", "condition", "isActive");

-- CreateIndex
CREATE INDEX "have_listings_userId_idx" ON "have_listings"("userId");

-- CreateIndex
CREATE INDEX "want_listings_cardId_minCondition_isActive_idx" ON "want_listings"("cardId", "minCondition", "isActive");

-- CreateIndex
CREATE INDEX "want_listings_userId_idx" ON "want_listings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "trades_proposalId_key" ON "trades"("proposalId");

-- CreateIndex
CREATE INDEX "trades_userAId_status_idx" ON "trades"("userAId", "status");

-- CreateIndex
CREATE INDEX "trades_userBId_status_idx" ON "trades"("userBId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "authenticators_userId_key" ON "authenticators"("userId");

-- CreateIndex
CREATE INDEX "authenticators_region_isActive_idx" ON "authenticators"("region", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "verification_assignments_tradeLegId_key" ON "verification_assignments"("tradeLegId");

-- CreateIndex
CREATE UNIQUE INDEX "escrows_tradeId_key" ON "escrows"("tradeId");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_variants" ADD CONSTRAINT "card_variants_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "have_listings" ADD CONSTRAINT "have_listings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "have_listings" ADD CONSTRAINT "have_listings_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "want_listings" ADD CONSTRAINT "want_listings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "want_listings" ADD CONSTRAINT "want_listings_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_proposal_legs" ADD CONSTRAINT "match_proposal_legs_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "match_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "match_proposals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_legs" ADD CONSTRAINT "trade_legs_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_legs" ADD CONSTRAINT "trade_legs_haveListingId_fkey" FOREIGN KEY ("haveListingId") REFERENCES "have_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_legs" ADD CONSTRAINT "trade_legs_wantListingId_fkey" FOREIGN KEY ("wantListingId") REFERENCES "want_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authenticators" ADD CONSTRAINT "authenticators_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_assignments" ADD CONSTRAINT "verification_assignments_tradeLegId_fkey" FOREIGN KEY ("tradeLegId") REFERENCES "trade_legs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_assignments" ADD CONSTRAINT "verification_assignments_authenticatorId_fkey" FOREIGN KEY ("authenticatorId") REFERENCES "authenticators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrows" ADD CONSTRAINT "escrows_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_entries" ADD CONSTRAINT "escrow_entries_escrowId_fkey" FOREIGN KEY ("escrowId") REFERENCES "escrows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
