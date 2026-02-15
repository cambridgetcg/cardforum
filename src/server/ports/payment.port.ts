/**
 * Payment Provider Port — Hexagonal Architecture boundary.
 *
 * Defines the contract that any payment provider (Stripe, Paddle, etc.)
 * must implement. Services depend on these interfaces, never on concrete SDKs.
 */

// ─── Core Payment ────────────────────────────────────

export interface CheckoutSessionParams {
  customerId: string;
  amountCents: number;
  currency: string;
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
  description?: string;
}

export interface CheckoutSessionResult {
  sessionId: string;
  url: string;
}

export interface CustomerCreateParams {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface IPaymentProvider {
  /** Create a customer in the payment provider */
  createCustomer(params: CustomerCreateParams): Promise<{ customerId: string }>;

  /** Create a checkout session for a one-time payment */
  createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult>;

  /** Construct and verify a webhook event from raw payload + signature */
  constructWebhookEvent(payload: string | Buffer, signature: string): Promise<PaymentWebhookEvent>;
}

// ─── Connect / Payouts ───────────────────────────────

export interface ConnectAccountParams {
  email: string;
  country?: string;
  metadata?: Record<string, string>;
}

export interface ConnectAccountResult {
  accountId: string;
}

export interface OnboardingLinkParams {
  accountId: string;
  returnUrl: string;
  refreshUrl: string;
}

export interface ConnectAccountStatus {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

export interface TransferParams {
  amountCents: number;
  currency: string;
  destinationAccountId: string;
  metadata?: Record<string, string>;
}

export interface TransferResult {
  transferId: string;
}

export interface IPayoutProvider {
  /** Create a connected account for payouts */
  createConnectAccount(params: ConnectAccountParams): Promise<ConnectAccountResult>;

  /** Generate an onboarding link for a connected account */
  createOnboardingLink(params: OnboardingLinkParams): Promise<{ url: string }>;

  /** Generate a dashboard login link for a connected account */
  createDashboardLink(accountId: string): Promise<{ url: string }>;

  /** Get the status of a connected account */
  getAccountStatus(accountId: string): Promise<ConnectAccountStatus>;

  /** Transfer funds to a connected account */
  createTransfer(params: TransferParams): Promise<TransferResult>;
}

// ─── Webhook Events ──────────────────────────────────

export type PaymentWebhookEvent =
  | { type: "checkout.session.completed"; sessionId: string; metadata: Record<string, string>; amountCents: number }
  | { type: "transfer.paid"; transferId: string }
  | { type: "transfer.failed"; transferId: string; reason: string }
  | { type: "transfer.reversed"; transferId: string; reason: string }
  | { type: "account.updated"; accountId: string; chargesEnabled: boolean; payoutsEnabled: boolean }
  | { type: "account.application.deauthorized"; accountId: string }
  | { type: "unknown"; rawType: string };
