import { NextResponse, type NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { deposit, freezeWallet } from "@/server/services/wallet.service";
import { markOnboardingComplete, markOnboardingRevoked } from "@/server/services/connect.service";
import {
  handleTransferPaid,
  handleTransferFailed,
  handleTransferReversed,
} from "@/server/services/payout.service";
import {
  handlePaymentAuthorized,
  handlePaymentFailed,
} from "@/server/services/marketplace-escrow.service";
import type Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // ─── Event-level idempotency ──────────────────────────
  // Stripe may deliver the same event multiple times. Dedup by event ID
  // to prevent duplicate notifications, state transitions, etc.
  const existing = await db.processedStripeEvent.findUnique({
    where: { id: event.id },
  });
  if (existing) {
    return NextResponse.json({ received: true, deduplicated: true });
  }

  const eventType = event.type as string;

  try {
    switch (eventType) {
      // ─── Deposits ──────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const type = session.metadata?.type;
        const payMethod = session.metadata?.paymentMethod;

        if (userId && type === "deposit" && session.amount_total) {
          if (payMethod === "ach") {
            // ACH: payment_status is "unpaid" — don't credit yet.
            // Update PendingDeposit with the payment intent ID.
            // Funds are credited on checkout.session.async_payment_succeeded.
            if (session.payment_intent) {
              await db.pendingDeposit.updateMany({
                where: { stripeSessionId: session.id },
                data: { stripePaymentIntentId: session.payment_intent as string },
              });
            }
            await db.notification.create({
              data: {
                userId,
                type: "ACH_PROCESSING",
                title: "Bank Transfer Processing",
                message: `Your deposit of $${(session.amount_total / 100).toFixed(2)} via bank transfer is processing. Funds will be available in 3–5 business days.`,
                link: "/wallet",
              },
            });
          } else {
            // Card: payment is immediate — credit wallet now
            await deposit(userId, session.amount_total, session.payment_intent as string);
          }
        }
        break;
      }

      // ACH deposit settled — bank confirmed the transfer
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const type = session.metadata?.type;

        if (userId && type === "deposit" && session.amount_total) {
          // Credit the wallet (also idempotent via stripePaymentIntentId)
          await deposit(userId, session.amount_total, session.payment_intent as string);

          // Mark PendingDeposit as settled
          await db.pendingDeposit.updateMany({
            where: { stripeSessionId: session.id },
            data: { status: "SUCCEEDED", resolvedAt: new Date() },
          });

          await db.notification.create({
            data: {
              userId,
              type: "ACH_SETTLED",
              title: "Bank Transfer Complete",
              message: `Your deposit of $${(session.amount_total / 100).toFixed(2)} has settled. Funds are now available in your wallet.`,
              link: "/wallet",
            },
          });
        }
        break;
      }

      // ACH deposit failed — bank rejected the transfer
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const type = session.metadata?.type;

        if (userId && type === "deposit") {
          await db.pendingDeposit.updateMany({
            where: { stripeSessionId: session.id },
            data: { status: "FAILED", resolvedAt: new Date() },
          });

          await db.notification.create({
            data: {
              userId,
              type: "ACH_FAILED",
              title: "Bank Transfer Failed",
              message: `Your deposit of $${((session.amount_total ?? 0) / 100).toFixed(2)} via bank transfer was declined by your bank. No funds were deducted. Please try again or use a card.`,
              link: "/wallet",
            },
          });
        }
        break;
      }

      // ─── Inline Deposits (PaymentIntent via Stripe Elements) ──
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const userId = pi.metadata?.userId;
        const type = pi.metadata?.type;

        if (type === "deposit" && userId && pi.amount) {
          // Wallet deposit — credit balance
          await deposit(userId, pi.amount, pi.id);
        } else if (type === "trade_escrow") {
          // Trade escrow — PaymentIntent captured (authorized or settled)
          await handlePaymentAuthorized(pi.id);
        }
        break;
      }

      // PaymentIntent authorized (manual capture) — trade escrow hold confirmed
      case "payment_intent.amount_capturable_updated": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const type = pi.metadata?.type;

        if (type === "trade_escrow") {
          await handlePaymentAuthorized(pi.id);
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const userId = pi.metadata?.userId;
        const type = pi.metadata?.type;

        if (type === "trade_escrow") {
          // Trade escrow payment failed — mark failed + notify
          await handlePaymentFailed(pi.id);
          if (userId) {
            const tradeId = pi.metadata?.tradeId;
            await db.notification.create({
              data: {
                userId,
                type: "TRADE_PAYMENT_FAILED",
                title: "Trade Payment Failed",
                message: `Payment authorization for trade #${tradeId?.slice(-6) ?? "unknown"} failed. The trade may be cancelled.`,
                link: tradeId ? `/trades/${tradeId}` : "/trades",
              },
            });
          }
        } else if (userId) {
          // Wallet deposit failed
          const message = pi.last_payment_error?.message ?? "Payment failed";
          await db.notification.create({
            data: {
              userId,
              type: "DEPOSIT_FAILED",
              title: "Deposit Failed",
              message: `Your deposit of $${((pi.amount ?? 0) / 100).toFixed(2)} failed: ${message}`,
              link: "/wallet",
            },
          });
        }
        break;
      }

      case "payment_intent.canceled": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const type = pi.metadata?.type;

        if (type === "trade_escrow") {
          // Trade escrow cancelled — release hold record
          await db.tradePayment.updateMany({
            where: { stripePaymentIntentId: pi.id },
            data: { status: "CANCELLED", cancelledAt: new Date() },
          });
        }
        break;
      }

      // ─── Chargebacks ───────────────────────────────
      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;

        // Find the user who made this payment via the payment intent
        const piId =
          typeof dispute.payment_intent === "string"
            ? dispute.payment_intent
            : dispute.payment_intent?.id;

        if (piId) {
          const walletTx = await db.walletTransaction.findUnique({
            where: { stripePaymentIntentId: piId },
          });

          if (walletTx) {
            // Freeze wallet to prevent withdrawals during dispute
            await freezeWallet(
              walletTx.userId,
              `Stripe chargeback: ${dispute.reason ?? "unknown"} (dispute ${dispute.id}, charge ${chargeId ?? "unknown"})`,
            );

            await db.notification.create({
              data: {
                userId: walletTx.userId,
                type: "CHARGEBACK_ALERT",
                title: "Payment Dispute Filed",
                message: `A chargeback has been filed for $${(dispute.amount / 100).toFixed(2)}. Your wallet has been frozen pending resolution.`,
                link: "/wallet",
              },
            });
          }
        }
        break;
      }

      case "charge.dispute.closed": {
        const dispute = event.data.object as Stripe.Dispute;
        const piId =
          typeof dispute.payment_intent === "string"
            ? dispute.payment_intent
            : dispute.payment_intent?.id;

        if (piId) {
          const walletTx = await db.walletTransaction.findUnique({
            where: { stripePaymentIntentId: piId },
          });

          if (walletTx) {
            const won = dispute.status === "won";
            await db.notification.create({
              data: {
                userId: walletTx.userId,
                type: "CHARGEBACK_RESOLVED",
                title: won ? "Dispute Resolved in Your Favor" : "Dispute Lost",
                message: won
                  ? `The chargeback for $${(dispute.amount / 100).toFixed(2)} was resolved in your favor. Your wallet has been unfrozen.`
                  : `The chargeback for $${(dispute.amount / 100).toFixed(2)} was upheld. The funds have been deducted.`,
                link: "/wallet",
              },
            });

            // Only unfreeze if no other active disputes exist for this user
            if (won) {
              // Check if user has other frozen reasons (could have multiple disputes)
              const user = await db.user.findUnique({
                where: { id: walletTx.userId },
                select: { walletFrozen: true, walletFrozenReason: true },
              });
              if (user?.walletFrozen && user.walletFrozenReason?.includes(dispute.id)) {
                await db.user.update({
                  where: { id: walletTx.userId },
                  data: { walletFrozen: false, walletFrozenReason: null },
                });
              }
            }
          }
        }
        break;
      }

      // ─── Connect Account ───────────────────────────
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        if (account.charges_enabled && account.details_submitted) {
          await markOnboardingComplete(account.id);
        }
        break;
      }

      case "account.application.deauthorized": {
        const account = event.data.object as Stripe.Account;
        await markOnboardingRevoked(account.id);
        break;
      }

      // ─── Transfers (platform → Connect) ────────────
      case "transfer.paid": {
        const transfer = event.data.object as Stripe.Transfer;
        await handleTransferPaid(transfer.id);
        break;
      }

      case "transfer.failed": {
        const transfer = event.data.object as Stripe.Transfer;
        const reason =
          (transfer as unknown as { failure_message?: string }).failure_message ??
          "Transfer failed";
        await handleTransferFailed(transfer.id, reason);
        break;
      }

      case "transfer.reversed": {
        const transfer = event.data.object as Stripe.Transfer;
        await handleTransferReversed(transfer.id, "Transfer reversed by Stripe");
        break;
      }

      // ─── Express Payouts (Connect → bank) ──────────
      case "payout.paid": {
        const payout = event.data.object as Stripe.Payout;
        const accountId = (event.account as string) ?? null;
        if (accountId) {
          const user = await db.user.findUnique({
            where: { stripeConnectAccountId: accountId },
            select: { id: true },
          });
          if (user) {
            await db.notification.create({
              data: {
                userId: user.id,
                type: "PAYOUT_COMPLETED",
                title: "Payout Completed",
                message: `Your payout of $${(payout.amount / 100).toFixed(2)} has arrived in your bank account.`,
                link: "/wallet",
              },
            });
          }
        }
        break;
      }

      case "payout.failed": {
        const payout = event.data.object as Stripe.Payout;
        const accountId = (event.account as string) ?? null;
        if (accountId) {
          const user = await db.user.findUnique({
            where: { stripeConnectAccountId: accountId },
            select: { id: true },
          });
          if (user) {
            const reason =
              (payout as unknown as { failure_message?: string }).failure_message ??
              "Bank rejected the payout";
            await db.notification.create({
              data: {
                userId: user.id,
                type: "PAYOUT_FAILED",
                title: "Payout Failed",
                message: `Your payout of $${(payout.amount / 100).toFixed(2)} failed: ${reason}. Please check your bank details in Stripe.`,
                link: "/wallet",
              },
            });
          }
        }
        break;
      }
    }

    // Mark event as processed AFTER successful handling
    await db.processedStripeEvent.create({
      data: { id: event.id, type: eventType },
    });
  } catch (err) {
    console.error(`Webhook handler failed for ${eventType}:`, err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
