import { assertNewPaidCommerceAllowed } from "@/lib/commerce-policy";
import { db } from "@/lib/db";
import { DIGITISATION_TRANSITIONS } from "@/types/domain";
import type {
  DigitisationStatus,
  Condition,
  DigitisationRequest,
  DigitalToken,
} from "@/generated/prisma/client";

// ─── Types ──────────────────────────────────────────────

interface CreateDigitisationInput {
  userId: string;
  cardId: string;
  condition: Condition;
  language?: string;
  authenticatorId: string;
  trackingInbound?: string;
  verificationFeeCents: number;
}

interface VerificationResult {
  verifiedCondition: Condition;
  ccsResult?: unknown;
}

// ─── Helpers ────────────────────────────────────────────

function assertTransition(from: DigitisationStatus, to: DigitisationStatus) {
  const allowed = DIGITISATION_TRANSITIONS[from as keyof typeof DIGITISATION_TRANSITIONS] ?? [];
  if (!allowed.includes(to as (typeof allowed)[number])) {
    throw new Error(`Invalid digitisation transition: ${from} → ${to}`);
  }
}

async function getRequestOrThrow(requestId: string) {
  return db.digitisationRequest.findUniqueOrThrow({
    where: { id: requestId },
  });
}

// ─── Lifecycle ──────────────────────────────────────────

export async function createDigitisationRequest(
  input: CreateDigitisationInput,
): Promise<DigitisationRequest> {
  assertNewPaidCommerceAllowed();
  // Validate authenticator is a vault operator
  const auth = await db.authenticator.findUniqueOrThrow({
    where: { id: input.authenticatorId },
    select: { isVaultOperator: true, isActive: true, applicationStatus: true },
  });

  if (!auth.isVaultOperator) {
    throw new Error("Selected authenticator is not a vault operator");
  }
  if (!auth.isActive || auth.applicationStatus !== "ACTIVE") {
    throw new Error("Selected authenticator is not active");
  }

  return db.digitisationRequest.create({
    data: {
      userId: input.userId,
      cardId: input.cardId,
      condition: input.condition,
      language: input.language ?? "EN",
      authenticatorId: input.authenticatorId,
      trackingInbound: input.trackingInbound,
      verificationFeeCents: input.verificationFeeCents,
    },
  });
}

export async function receiveCard(
  requestId: string,
  authenticatorUserId: string,
): Promise<DigitisationRequest> {
  const request = await getRequestOrThrow(requestId);
  assertTransition(request.status, "RECEIVED");

  // Verify the caller is the assigned authenticator
  const auth = await db.authenticator.findUnique({
    where: { userId: authenticatorUserId },
    select: { id: true },
  });
  if (!auth || auth.id !== request.authenticatorId) {
    throw new Error("Only the assigned authenticator can receive cards");
  }

  return db.digitisationRequest.update({
    where: { id: requestId },
    data: { status: "RECEIVED", receivedAt: new Date() },
  });
}

export async function startVerification(
  requestId: string,
  authenticatorUserId: string,
): Promise<DigitisationRequest> {
  const request = await getRequestOrThrow(requestId);
  assertTransition(request.status, "VERIFYING");

  const auth = await db.authenticator.findUnique({
    where: { userId: authenticatorUserId },
    select: { id: true },
  });
  if (!auth || auth.id !== request.authenticatorId) {
    throw new Error("Only the assigned authenticator can start verification");
  }

  return db.digitisationRequest.update({
    where: { id: requestId },
    data: { status: "VERIFYING" },
  });
}

export async function completeVerification(
  requestId: string,
  result: VerificationResult,
  autoMint: boolean = true,
): Promise<{ request: DigitisationRequest; token?: DigitalToken }> {
  const request = await getRequestOrThrow(requestId);
  assertTransition(request.status, "VERIFIED");

  const verified = await db.digitisationRequest.update({
    where: { id: requestId },
    data: {
      status: "VERIFIED",
      verifiedCondition: result.verifiedCondition,
      ccsResult: (result.ccsResult as object) ?? undefined,
      verifiedAt: new Date(),
    },
  });

  // Auto-mint: eliminate the separate mint step
  if (autoMint) {
    return mintToken(requestId);
  }

  return { request: verified };
}

/**
 * Receive + verify in a single authenticator action.
 * Merges receive → verify → auto-mint into one step.
 */
export async function receiveAndVerify(
  requestId: string,
  authenticatorUserId: string,
  result: VerificationResult,
): Promise<{ request: DigitisationRequest; token: DigitalToken }> {
  const request = await getRequestOrThrow(requestId);

  // Verify the caller is the assigned authenticator
  const auth = await db.authenticator.findUnique({
    where: { userId: authenticatorUserId },
    select: { id: true },
  });
  if (!auth || auth.id !== request.authenticatorId) {
    throw new Error("Only the assigned authenticator can process this request");
  }

  // Must be in SUBMITTED or RECEIVED state
  if (request.status !== "SUBMITTED" && request.status !== "RECEIVED") {
    throw new Error(`Cannot receive-and-verify from status: ${request.status}`);
  }

  // Mark received
  await db.digitisationRequest.update({
    where: { id: requestId },
    data: { status: "RECEIVED", receivedAt: new Date() },
  });

  // Complete verification (auto-mints)
  return completeVerification(requestId, result, true) as Promise<{
    request: DigitisationRequest;
    token: DigitalToken;
  }>;
}

export async function mintToken(
  requestId: string,
): Promise<{ request: DigitisationRequest; token: DigitalToken }> {
  const request = await getRequestOrThrow(requestId);
  assertTransition(request.status, "MINTED");

  if (!request.verifiedCondition) {
    throw new Error("Cannot mint token: verification not completed");
  }

  return db.$transaction(async (tx) => {
    const now = new Date();

    // Create the digital token
    const token = await tx.digitalToken.create({
      data: {
        cardId: request.cardId,
        condition: request.verifiedCondition!,
        language: request.language,
        digitiserId: request.userId,
        currentOwnerId: request.userId,
        vaultAuthenticatorId: request.authenticatorId,
        mintedAt: now,
      },
    });

    // Update request → MINTED
    const updatedRequest = await tx.digitisationRequest.update({
      where: { id: requestId },
      data: { status: "MINTED", tokenId: token.id, mintedAt: now },
    });

    // Upsert vault inventory (physical stock)
    await tx.authenticatorInventory.upsert({
      where: {
        authenticatorId_cardId_condition_language: {
          authenticatorId: request.authenticatorId,
          cardId: request.cardId,
          condition: request.verifiedCondition!,
          language: request.language,
        },
      },
      create: {
        authenticatorId: request.authenticatorId,
        cardId: request.cardId,
        condition: request.verifiedCondition!,
        language: request.language,
        quantity: 1,
        isAvailable: true,
      },
      update: {
        quantity: { increment: 1 },
        isAvailable: true,
      },
    });

    // Debit verification fee from digitiser
    const user = await tx.user.findUniqueOrThrow({
      where: { id: request.userId },
      select: { walletBalance: true },
    });
    const feeAmount = -request.verificationFeeCents;
    const newBalance = user.walletBalance + feeAmount;
    if (newBalance < 0) {
      throw new Error("Insufficient wallet balance for verification fee");
    }
    await tx.user.update({
      where: { id: request.userId },
      data: { walletBalance: newBalance },
    });
    await tx.walletTransaction.create({
      data: {
        userId: request.userId,
        type: "DIGITISATION_FEE",
        amount: feeAmount,
        balanceAfter: newBalance,
        description: `Digitisation fee for card ${request.cardId.slice(-6)}`,
      },
    });

    // Credit authenticator
    const auth = await tx.authenticator.findUniqueOrThrow({
      where: { id: request.authenticatorId },
      select: { userId: true },
    });
    const authUser = await tx.user.findUniqueOrThrow({
      where: { id: auth.userId },
      select: { walletBalance: true },
    });
    const authNewBalance = authUser.walletBalance + request.verificationFeeCents;
    await tx.user.update({
      where: { id: auth.userId },
      data: { walletBalance: authNewBalance },
    });
    await tx.walletTransaction.create({
      data: {
        userId: auth.userId,
        type: "AUTHENTICATOR_EARN",
        amount: request.verificationFeeCents,
        balanceAfter: authNewBalance,
        description: `Digitisation verification payout for card ${request.cardId.slice(-6)}`,
      },
    });

    return { request: updatedRequest, token };
  });
}

export async function rejectDigitisation(
  requestId: string,
  reason: string,
): Promise<DigitisationRequest> {
  const request = await getRequestOrThrow(requestId);
  assertTransition(request.status, "REJECTED");

  return db.digitisationRequest.update({
    where: { id: requestId },
    data: { status: "REJECTED", rejectionReason: reason },
  });
}

export async function cancelDigitisation(
  requestId: string,
  userId: string,
): Promise<DigitisationRequest> {
  const request = await getRequestOrThrow(requestId);
  assertTransition(request.status, "CANCELLED");

  if (request.userId !== userId) {
    throw new Error("Only the requester can cancel a digitisation request");
  }

  return db.digitisationRequest.update({
    where: { id: requestId },
    data: { status: "CANCELLED" },
  });
}

// ─── Queries ────────────────────────────────────────────

export async function getUserDigitisationRequests(userId: string): Promise<DigitisationRequest[]> {
  return db.digitisationRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      card: true,
      authenticator: { select: { id: true, businessName: true, region: true } },
    },
  });
}

export async function getDigitisationRequest(
  requestId: string,
): Promise<DigitisationRequest | null> {
  return db.digitisationRequest.findUnique({
    where: { id: requestId },
    include: { card: true, authenticator: true, token: true },
  });
}

export async function getAuthenticatorDigitisationRequests(
  authenticatorId: string,
): Promise<DigitisationRequest[]> {
  return db.digitisationRequest.findMany({
    where: { authenticatorId },
    orderBy: { createdAt: "desc" },
    include: { card: true, user: { select: { id: true, name: true, email: true } } },
  });
}
