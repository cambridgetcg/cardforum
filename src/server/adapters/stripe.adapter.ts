/**
 * Stripe Adapter — Implements IPaymentProvider + IPayoutProvider
 *
 * Wraps the Stripe SDK behind the payment port interfaces.
 * All Stripe-specific logic is contained here; services only
 * interact through the port contracts.
 */

import Stripe from "stripe";
import type {
  IPaymentProvider,
  IPayoutProvider,
  CheckoutSessionParams,
  CheckoutSessionResult,
  CustomerCreateParams,
  PaymentIntentParams,
  PaymentIntentResult,
  ConnectAccountParams,
  ConnectAccountResult,
  OnboardingLinkParams,
  ConnectAccountStatus,
  TransferParams,
  TransferResult,
  MarketplaceTransferParams,
  PaymentWebhookEvent,
} from "@/server/ports/payment.port";

export class StripePaymentAdapter implements IPaymentProvider {
  constructor(private readonly stripe: Stripe) {}

  async createCustomer(params: CustomerCreateParams): Promise<{ customerId: string }> {
    const customer = await this.stripe.customers.create({
      email: params.email,
      name: params.name,
      metadata: params.metadata,
    });
    return { customerId: customer.id };
  }

  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
    const session = await this.stripe.checkout.sessions.create({
      customer: params.customerId,
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: params.currency,
            unit_amount: params.amountCents,
            product_data: {
              name: "Wallet Deposit",
              description: params.description,
            },
          },
          quantity: 1,
        },
      ],
      metadata: params.metadata,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });

    if (!session.url) {
      throw new Error("Failed to create checkout session");
    }

    return { sessionId: session.id, url: session.url };
  }

  async constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
  ): Promise<PaymentWebhookEvent> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET not configured");

    const event = this.stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret,
    );

    return mapStripeEvent(event);
  }

  async createPaymentIntent(params: PaymentIntentParams): Promise<PaymentIntentResult> {
    const pi = await this.stripe.paymentIntents.create({
      customer: params.customerId,
      amount: params.amountCents,
      currency: params.currency,
      capture_method: params.captureMethod,
      metadata: params.metadata,
      ...(params.paymentMethodId ? {
        payment_method: params.paymentMethodId,
        confirm: true,
      } : {}),
    });

    return {
      paymentIntentId: pi.id,
      clientSecret: pi.client_secret ?? "",
      status: pi.status,
    };
  }

  async capturePaymentIntent(paymentIntentId: string): Promise<{ chargeId: string }> {
    const pi = await this.stripe.paymentIntents.capture(paymentIntentId);
    const chargeId = typeof pi.latest_charge === "string"
      ? pi.latest_charge
      : pi.latest_charge?.id ?? "";
    return { chargeId };
  }

  async cancelPaymentIntent(paymentIntentId: string): Promise<void> {
    await this.stripe.paymentIntents.cancel(paymentIntentId);
  }
}

export class StripePayoutAdapter implements IPayoutProvider {
  constructor(private readonly stripe: Stripe) {}

  async createConnectAccount(params: ConnectAccountParams): Promise<ConnectAccountResult> {
    const account = await this.stripe.accounts.create({
      type: "express",
      email: params.email,
      country: params.country,
      metadata: params.metadata,
      capabilities: { transfers: { requested: true } },
    });
    return { accountId: account.id };
  }

  async createOnboardingLink(params: OnboardingLinkParams): Promise<{ url: string }> {
    const link = await this.stripe.accountLinks.create({
      account: params.accountId,
      type: "account_onboarding",
      return_url: params.returnUrl,
      refresh_url: params.refreshUrl,
    });
    return { url: link.url };
  }

  async createDashboardLink(accountId: string): Promise<{ url: string }> {
    const link = await this.stripe.accounts.createLoginLink(accountId);
    return { url: link.url };
  }

  async getAccountStatus(accountId: string): Promise<ConnectAccountStatus> {
    const account = await this.stripe.accounts.retrieve(accountId);
    return {
      chargesEnabled: account.charges_enabled ?? false,
      payoutsEnabled: account.payouts_enabled ?? false,
      detailsSubmitted: account.details_submitted ?? false,
    };
  }

  async createTransfer(params: TransferParams): Promise<TransferResult> {
    const transfer = await this.stripe.transfers.create({
      amount: params.amountCents,
      currency: params.currency,
      destination: params.destinationAccountId,
      metadata: params.metadata,
    });
    return { transferId: transfer.id };
  }

  async createTransferFromPayment(params: MarketplaceTransferParams): Promise<TransferResult> {
    const transfer = await this.stripe.transfers.create({
      amount: params.amountCents,
      currency: params.currency,
      destination: params.destinationAccountId,
      source_transaction: params.sourceChargeId,
      metadata: params.metadata,
    });
    return { transferId: transfer.id };
  }
}

// ─── Event Mapping ───────────────────────────────────

function mapStripeEvent(event: Stripe.Event): PaymentWebhookEvent {
  const type = event.type as string;

  switch (type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      return {
        type: "checkout.session.completed",
        sessionId: session.id,
        metadata: (session.metadata ?? {}) as Record<string, string>,
        amountCents: session.amount_total ?? 0,
      };
    }
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      return {
        type: "payment_intent.succeeded",
        paymentIntentId: pi.id,
        metadata: (pi.metadata ?? {}) as Record<string, string>,
        amountCents: pi.amount,
      };
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      return {
        type: "payment_intent.payment_failed",
        paymentIntentId: pi.id,
        metadata: (pi.metadata ?? {}) as Record<string, string>,
        reason: pi.last_payment_error?.message ?? "Payment failed",
      };
    }
    case "payment_intent.canceled": {
      const pi = event.data.object as Stripe.PaymentIntent;
      return {
        type: "payment_intent.canceled",
        paymentIntentId: pi.id,
        metadata: (pi.metadata ?? {}) as Record<string, string>,
      };
    }
    case "transfer.paid": {
      const transfer = event.data.object as Stripe.Transfer;
      return { type: "transfer.paid", transferId: transfer.id };
    }
    case "transfer.failed": {
      const transfer = event.data.object as Stripe.Transfer;
      return {
        type: "transfer.failed",
        transferId: transfer.id,
        reason: ((transfer as unknown as Record<string, unknown>).failure_message as string) ?? "Transfer failed",
      };
    }
    case "transfer.reversed": {
      const transfer = event.data.object as Stripe.Transfer;
      return {
        type: "transfer.reversed",
        transferId: transfer.id,
        reason: "Transfer reversed",
      };
    }
    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      return {
        type: "account.updated",
        accountId: account.id,
        chargesEnabled: account.charges_enabled ?? false,
        payoutsEnabled: account.payouts_enabled ?? false,
      };
    }
    case "account.application.deauthorized": {
      const account = event.data.object as Stripe.Account;
      return { type: "account.application.deauthorized", accountId: account.id };
    }
    default:
      return { type: "unknown", rawType: type };
  }
}

// ─── Factory ─────────────────────────────────────────

let _paymentAdapter: StripePaymentAdapter | undefined;
let _payoutAdapter: StripePayoutAdapter | undefined;

function getStripeInstance(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key, { apiVersion: "2026-01-28.clover", typescript: true });
}

export function getPaymentProvider(): IPaymentProvider {
  if (!_paymentAdapter) {
    _paymentAdapter = new StripePaymentAdapter(getStripeInstance());
  }
  return _paymentAdapter;
}

export function getPayoutProvider(): IPayoutProvider {
  if (!_payoutAdapter) {
    _payoutAdapter = new StripePayoutAdapter(getStripeInstance());
  }
  return _payoutAdapter;
}
