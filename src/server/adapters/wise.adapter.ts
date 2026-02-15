/**
 * Wise Adapter — Implements IPayoutProvider for Wise (formerly TransferWise).
 *
 * Wise uses a multi-step payout flow: quote → recipient → transfer → fund.
 * This adapter maps that flow to the IPayoutProvider interface so services
 * can swap between Stripe Connect and Wise without code changes.
 *
 * Key differences from Stripe:
 *   - No "connected account" — Wise uses recipient accounts (bank details)
 *   - No onboarding link — recipients are created via API with bank details
 *   - No dashboard link — Wise has no per-recipient dashboard
 *   - Multi-currency native — Wise excels at cross-border payouts
 *   - Requires SCA (Strong Customer Authentication) for funding transfers
 *
 * Wise API docs: https://docs.wise.com/api-reference
 */

import type {
  IPayoutProvider,
  ConnectAccountParams,
  ConnectAccountResult,
  OnboardingLinkParams,
  ConnectAccountStatus,
  TransferParams,
  TransferResult,
  PaymentWebhookEvent,
} from "@/server/ports/payment.port";
import crypto from "crypto";

// ─── Configuration ───────────────────────────────────

const WISE_API_URL_SANDBOX = "https://api.sandbox.transferwise.tech";
const WISE_API_URL_LIVE = "https://api.transferwise.com";
const WISE_API_TIMEOUT_MS = 30_000;

interface WiseConfig {
  apiToken: string;
  profileId: string;
  environment: "sandbox" | "live";
  /** RSA private key PEM for SCA (Strong Customer Authentication) signing */
  scaPrivateKey?: string;
  /** Webhook signing secret for verifying inbound webhooks */
  webhookSecret?: string;
}

function getWiseConfig(): WiseConfig {
  const apiToken = process.env.WISE_API_TOKEN;
  if (!apiToken) throw new Error("WISE_API_TOKEN is not set");

  const profileId = process.env.WISE_PROFILE_ID;
  if (!profileId) throw new Error("WISE_PROFILE_ID is not set");

  return {
    apiToken,
    profileId,
    environment: (process.env.WISE_ENVIRONMENT as "sandbox" | "live") ?? "sandbox",
    scaPrivateKey: process.env.WISE_SCA_PRIVATE_KEY,
    webhookSecret: process.env.WISE_WEBHOOK_SECRET,
  };
}

function getBaseUrl(config: WiseConfig): string {
  return config.environment === "live" ? WISE_API_URL_LIVE : WISE_API_URL_SANDBOX;
}

// ─── Wise API Types ──────────────────────────────────

export interface WiseQuote {
  id: number;
  source: string;
  target: string;
  sourceAmount: number;
  targetAmount: number;
  rate: number;
  fee: number;
  rateType: string;
  createdTime: string;
  expirationTime: string;
}

export interface WiseRecipient {
  id: number;
  profileId: number;
  accountHolderName: string;
  currency: string;
  country: string;
  type: string;
  active: boolean;
}

export type WiseTransferStatus =
  | "incoming_payment_waiting"
  | "incoming_payment_initiated"
  | "processing"
  | "funds_converted"
  | "outgoing_payment_sent"
  | "cancelled"
  | "refunded"
  | "bounced_back"
  | "funds_refunded"
  | "charged_back"
  | "unknown";

export interface WiseTransfer {
  id: number;
  user: number;
  targetAccount: number;
  sourceAccount: number | null;
  quote: number;
  quoteUuid: string;
  status: WiseTransferStatus;
  reference: string;
  rate: number;
  created: string;
  business: number | null;
  transferRequest: number | null;
  details: {
    reference: string;
  };
  hasActiveIssues: boolean;
  sourceCurrency: string;
  sourceValue: number;
  targetCurrency: string;
  targetValue: number;
  customerTransactionId: string;
}

export interface WiseFundingResult {
  type: string;
  status: "COMPLETED" | "REJECTED";
  errorCode: string | null;
}

/** Webhook event body from Wise */
export interface WiseWebhookEvent {
  data: {
    resource: {
      id: number;
      profile_id: number;
      account_id: number;
      type: string;
    };
    current_state: string;
    previous_state: string;
    occurred_at: string;
  };
  subscription_id: string;
  event_type: string;
  schema_version: string;
  sent_at: string;
}

// ─── HTTP Client ─────────────────────────────────────

async function wiseRequest<T>(
  config: WiseConfig,
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const baseUrl = getBaseUrl(config);
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiToken}`,
    ...extraHeaders,
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(WISE_API_TIMEOUT_MS),
  });

  if (res.status === 403 && res.headers.get("x-2fa-approval")) {
    // SCA challenge — sign the one-time token and retry
    return handleScaChallenge<T>(config, method, path, body, res);
  }

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`Wise API error ${res.status}: ${errorBody}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function handleScaChallenge<T>(
  config: WiseConfig,
  method: string,
  path: string,
  body: unknown,
  challengeResponse: Response,
): Promise<T> {
  if (!config.scaPrivateKey) {
    throw new Error("Wise SCA private key not configured — cannot complete strong authentication");
  }

  const oneTimeToken = challengeResponse.headers.get("x-2fa-approval");
  if (!oneTimeToken) {
    throw new Error("Wise SCA challenge missing one-time token");
  }

  // Sign the OTT with RSA-SHA256
  const signer = crypto.createSign("SHA256");
  signer.update(oneTimeToken);
  const signature = signer.sign(config.scaPrivateKey, "base64");

  // Retry with SCA headers
  return wiseRequest<T>(config, method, path, body, {
    "X-2FA-Approval": oneTimeToken,
    "X-Signature": signature,
  });
}

// ─── Wise-Specific Operations ────────────────────────

/**
 * Create a quote for a payout.
 * Wise requires a quote before creating a transfer.
 */
export async function createQuote(
  config: WiseConfig,
  sourceCurrency: string,
  targetCurrency: string,
  sourceAmountCents: number,
): Promise<WiseQuote> {
  return wiseRequest<WiseQuote>(config, "POST", "/v1/quotes", {
    profile: Number(config.profileId),
    source: sourceCurrency,
    target: targetCurrency,
    rateType: "FIXED",
    sourceAmount: sourceAmountCents / 100, // Wise uses decimal amounts
    type: "BALANCE_PAYOUT",
  });
}

/**
 * Create a recipient account.
 * The details object varies by target currency/country.
 */
export async function createRecipient(
  config: WiseConfig,
  params: {
    accountHolderName: string;
    currency: string;
    type: string;
    details: Record<string, unknown>;
    ownedByCustomer?: boolean;
  },
): Promise<WiseRecipient> {
  return wiseRequest<WiseRecipient>(config, "POST", "/v1/accounts", {
    profile: Number(config.profileId),
    accountHolderName: params.accountHolderName,
    currency: params.currency,
    type: params.type,
    ownedByCustomer: params.ownedByCustomer ?? false,
    details: params.details,
  });
}

/**
 * Get a recipient account by ID.
 */
export async function getRecipient(
  config: WiseConfig,
  recipientId: number,
): Promise<WiseRecipient> {
  return wiseRequest<WiseRecipient>(config, "GET", `/v1/accounts/${recipientId}`);
}

/**
 * Create and fund a transfer in one flow.
 * Steps: create quote → create transfer → fund transfer.
 */
export async function createAndFundTransfer(
  config: WiseConfig,
  params: {
    recipientId: number;
    sourceCurrency: string;
    targetCurrency: string;
    sourceAmountCents: number;
    reference: string;
    customerTransactionId: string;
  },
): Promise<WiseTransfer> {
  // Step 1: Create quote
  const quote = await createQuote(
    config,
    params.sourceCurrency,
    params.targetCurrency,
    params.sourceAmountCents,
  );

  // Step 2: Create transfer
  const transfer = await wiseRequest<WiseTransfer>(config, "POST", "/v1/transfers", {
    targetAccount: params.recipientId,
    quoteUuid: quote.id,
    customerTransactionId: params.customerTransactionId,
    details: {
      reference: params.reference,
    },
  });

  // Step 3: Fund transfer from Wise balance
  await wiseRequest<WiseFundingResult>(
    config,
    "POST",
    `/v3/profiles/${config.profileId}/transfers/${transfer.id}/payments`,
    { type: "BALANCE" },
  );

  return transfer;
}

/**
 * Get transfer status by ID.
 */
export async function getTransfer(
  config: WiseConfig,
  transferId: number,
): Promise<WiseTransfer> {
  return wiseRequest<WiseTransfer>(config, "GET", `/v1/transfers/${transferId}`);
}

/**
 * Cancel a transfer.
 */
export async function cancelTransfer(
  config: WiseConfig,
  transferId: number,
): Promise<void> {
  await wiseRequest<void>(config, "PUT", `/v1/transfers/${transferId}/cancel`);
}

// ─── IPayoutProvider Implementation ──────────────────

export class WisePayoutAdapter implements IPayoutProvider {
  private config: WiseConfig;

  constructor(config?: WiseConfig) {
    this.config = config ?? getWiseConfig();
  }

  /**
   * Create a "connected account" (Wise recipient).
   *
   * NOTE: Wise recipients require bank details (account number, sort code, etc.)
   * which vary by country. For the initial integration, the metadata field carries
   * bank details. In production, a dedicated onboarding form collects these.
   *
   * Expected metadata keys for common currencies:
   *   GBP: { sortCode, accountNumber, accountHolderName }
   *   EUR: { IBAN, accountHolderName }
   *   USD: { routingNumber, accountNumber, accountType, accountHolderName }
   */
  async createConnectAccount(params: ConnectAccountParams): Promise<ConnectAccountResult> {
    const meta = params.metadata ?? {};
    const currency = meta.currency ?? "GBP";
    const accountType = meta.accountType ?? "sort_code"; // sort_code (GBP), iban (EUR), aba (USD)

    const recipient = await createRecipient(this.config, {
      accountHolderName: meta.accountHolderName ?? params.email,
      currency,
      type: accountType,
      ownedByCustomer: false,
      details: buildRecipientDetails(currency, meta),
    });

    return { accountId: String(recipient.id) };
  }

  /**
   * Wise doesn't have onboarding links like Stripe Connect.
   * Returns a link to Wise's recipient requirements page as guidance.
   * In practice, the CardForum UI collects bank details directly.
   */
  async createOnboardingLink(params: OnboardingLinkParams): Promise<{ url: string }> {
    // No Wise equivalent — return the app's own bank details form
    return { url: params.returnUrl };
  }

  /**
   * Wise doesn't have per-recipient dashboard links.
   * Returns a link to Wise's main site where users can track their transfers.
   */
  async createDashboardLink(_accountId: string): Promise<{ url: string }> {
    return { url: "https://wise.com/user/account" };
  }

  /**
   * Check if a Wise recipient is active and can receive payouts.
   */
  async getAccountStatus(accountId: string): Promise<ConnectAccountStatus> {
    try {
      const recipient = await getRecipient(this.config, Number(accountId));
      return {
        chargesEnabled: false, // Wise recipients don't charge — they receive payouts
        payoutsEnabled: recipient.active,
        detailsSubmitted: true, // If we can fetch it, details were submitted
      };
    } catch {
      return {
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      };
    }
  }

  /**
   * Transfer funds to a Wise recipient.
   *
   * Creates a quote, transfer, and funds it from the Wise balance.
   * The currency is inferred from the recipient's account or the params.
   */
  async createTransfer(params: TransferParams): Promise<TransferResult> {
    const recipientId = Number(params.destinationAccountId);
    const sourceCurrency = params.currency.toUpperCase();

    // Look up recipient to determine target currency
    const recipient = await getRecipient(this.config, recipientId);
    const targetCurrency = recipient.currency;

    const transfer = await createAndFundTransfer(this.config, {
      recipientId,
      sourceCurrency,
      targetCurrency,
      sourceAmountCents: params.amountCents,
      reference: params.metadata?.description ?? "CardForum payout",
      customerTransactionId: params.metadata?.walletTransactionId ?? crypto.randomUUID(),
    });

    return { transferId: String(transfer.id) };
  }
}

// ─── Recipient Detail Builders ───────────────────────

function buildRecipientDetails(
  currency: string,
  meta: Record<string, string>,
): Record<string, unknown> {
  switch (currency.toUpperCase()) {
    case "GBP":
      return {
        legalType: meta.legalType ?? "PRIVATE",
        sortCode: meta.sortCode,
        accountNumber: meta.accountNumber,
      };
    case "EUR":
      return {
        legalType: meta.legalType ?? "PRIVATE",
        IBAN: meta.IBAN ?? meta.iban,
      };
    case "USD":
      return {
        legalType: meta.legalType ?? "PRIVATE",
        abartn: meta.routingNumber ?? meta.abartn,
        accountNumber: meta.accountNumber,
        accountType: meta.accountType ?? "CHECKING",
        address: meta.address ? JSON.parse(meta.address) : undefined,
      };
    case "AUD":
      return {
        legalType: meta.legalType ?? "PRIVATE",
        bsbCode: meta.bsbCode,
        accountNumber: meta.accountNumber,
      };
    case "CAD":
      return {
        legalType: meta.legalType ?? "PRIVATE",
        institutionNumber: meta.institutionNumber,
        transitNumber: meta.transitNumber,
        accountNumber: meta.accountNumber,
        accountType: meta.accountType ?? "CHECKING",
      };
    case "JPY":
      return {
        legalType: meta.legalType ?? "PRIVATE",
        bankCode: meta.bankCode,
        branchCode: meta.branchCode,
        accountNumber: meta.accountNumber,
        accountType: meta.accountType ?? "CHECKING",
      };
    default:
      // For other currencies, pass through all metadata as details
      // Caller should consult Wise's account-requirements API
      return Object.fromEntries(
        Object.entries(meta).filter(([k]) =>
          !["currency", "accountType", "accountHolderName"].includes(k),
        ),
      );
  }
}

// ─── Webhook Verification ────────────────────────────

/**
 * Verify a Wise webhook signature and parse the event.
 *
 * Wise signs webhooks using the signature in the X-Signature-SHA256 header.
 * The signature is an HMAC-SHA256 of the raw body using the webhook secret.
 */
export function verifyAndParseWebhook(
  rawBody: string | Buffer,
  signature: string,
  secret: string,
): WiseWebhookEvent {
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    throw new Error("Wise webhook signature verification failed");
  }

  return JSON.parse(typeof rawBody === "string" ? rawBody : rawBody.toString()) as WiseWebhookEvent;
}

/**
 * Map a Wise webhook event to the unified PaymentWebhookEvent type.
 */
export function mapWiseWebhookEvent(event: WiseWebhookEvent): PaymentWebhookEvent {
  const eventType = event.event_type;
  const transferId = String(event.data.resource.id);
  const currentState = event.data.current_state;

  if (eventType === "transfers#state-change") {
    switch (currentState) {
      case "outgoing_payment_sent":
        return { type: "transfer.paid", transferId };
      case "bounced_back":
      case "funds_refunded":
      case "charged_back":
        return {
          type: "transfer.failed",
          transferId,
          reason: `Transfer ${currentState.replace(/_/g, " ")}`,
        };
      case "cancelled":
        return {
          type: "transfer.reversed",
          transferId,
          reason: "Transfer cancelled",
        };
      default:
        // Processing states — not a terminal event
        return { type: "unknown", rawType: `wise.${eventType}.${currentState}` };
    }
  }

  if (eventType === "transfers#payout-failure") {
    return {
      type: "transfer.failed",
      transferId,
      reason: "Payout failed",
    };
  }

  if (eventType === "transfers#refund") {
    return {
      type: "transfer.reversed",
      transferId,
      reason: "Transfer refunded",
    };
  }

  return { type: "unknown", rawType: `wise.${eventType}` };
}

// ─── Factory ─────────────────────────────────────────

let _instance: WisePayoutAdapter | undefined;

export function getWisePayoutProvider(): IPayoutProvider {
  if (!_instance) {
    _instance = new WisePayoutAdapter();
  }
  return _instance;
}

/**
 * Check if Wise is configured and available.
 */
export function isWiseConfigured(): boolean {
  return !!(process.env.WISE_API_TOKEN && process.env.WISE_PROFILE_ID);
}
