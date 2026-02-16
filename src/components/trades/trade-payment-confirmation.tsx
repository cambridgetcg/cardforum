"use client";

import { useState, useEffect, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  ShieldCheck,
} from "lucide-react";
import { formatPrice } from "@/types/domain";

// ─── Types ──────────────────────────────────────────────

interface PendingPayment {
  id: string;
  amountCents: number;
  stripePaymentIntentId: string | null;
  status: string;
  clientSecret: string | null;
}

interface PaymentSummaryEntry {
  userId: string;
  amountCents: number;
  status: string;
}

interface PaymentSummary {
  payments: PaymentSummaryEntry[];
  totalCharged: number;
  totalTransferred: number;
  totalFees: number;
  myPendingPayments: PendingPayment[];
}

// ─── Stripe Setup ───────────────────────────────────────

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

// ─── Inline Payment Form ────────────────────────────────

function PaymentForm({
  onSuccess,
  amountCents,
}: {
  onSuccess: () => void;
  amountCents: number;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError("");

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? "Validation failed");
      setProcessing(false);
      return;
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}${window.location.pathname}?payment=success`,
      },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment authorization failed");
      setProcessing(false);
    } else {
      onSuccess();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="rounded-lg border border-gray-200 p-3">
        <PaymentElement />
      </div>
      {error && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 p-2.5 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}
      <Button
        type="submit"
        disabled={!stripe || processing}
        className="w-full"
      >
        {processing ? (
          <>
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            Authorizing...
          </>
        ) : (
          <>
            <ShieldCheck className="mr-1.5 h-4 w-4" />
            Authorize {formatPrice(amountCents)}
          </>
        )}
      </Button>
      <p className="text-[10px] text-gray-400 text-center">
        Your card will be authorized but not charged until the trade completes.
      </p>
    </form>
  );
}

// ─── Status Helpers ─────────────────────────────────────

function PaymentStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "AUTHORIZED":
    case "CAPTURED":
      return (
        <Badge className="bg-green-100 text-green-700">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          {status === "AUTHORIZED" ? "Authorized" : "Captured"}
        </Badge>
      );
    case "REQUIRES_ACTION":
    case "PENDING":
      return (
        <Badge className="bg-amber-100 text-amber-700">
          <CreditCard className="mr-1 h-3 w-3" />
          Action Required
        </Badge>
      );
    case "FAILED":
      return (
        <Badge className="bg-red-100 text-red-700">
          <AlertCircle className="mr-1 h-3 w-3" />
          Failed
        </Badge>
      );
    case "CANCELLED":
      return (
        <Badge className="bg-gray-100 text-gray-600">Cancelled</Badge>
      );
    default:
      return <Badge className="bg-gray-100 text-gray-600">{status}</Badge>;
  }
}

// ─── Main Component ─────────────────────────────────────

export function TradePaymentConfirmation({
  tradeId,
  tradeStatus,
  onPaymentConfirmed,
}: {
  tradeId: string;
  tradeStatus: string;
  onPaymentConfirmed?: () => void;
}) {
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const fetchPayment = useCallback(async () => {
    try {
      const res = await fetch(`/api/trades/${tradeId}/payment`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to load payment info");
        return;
      }
      const data: PaymentSummary = await res.json();
      setSummary(data);
      setError(null);
    } catch {
      setError("Failed to load payment info");
    } finally {
      setLoading(false);
    }
  }, [tradeId]);

  useEffect(() => {
    fetchPayment();
  }, [fetchPayment]);

  // Poll for payment status updates after confirming
  useEffect(() => {
    if (!confirmed) return;
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts >= 20) {
        clearInterval(interval);
        setConfirmed(false);
        return;
      }
      await fetchPayment();
    }, 3000);
    return () => clearInterval(interval);
  }, [confirmed, fetchPayment]);

  // Stop polling once all payments are authorized
  useEffect(() => {
    if (!summary || !confirmed) return;
    const pendingCount = summary.myPendingPayments.length;
    if (pendingCount === 0) {
      setConfirmed(false);
      onPaymentConfirmed?.();
    }
  }, [summary, confirmed, onPaymentConfirmed]);

  function handlePaymentSuccess() {
    setConfirmed(true);
    fetchPayment();
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="flex items-start gap-2 text-sm text-red-600">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  const myPayment = summary.payments.find(
    (p) => summary.myPendingPayments.some((mp) => mp.stripePaymentIntentId === p.amountCents.toString())
  ) ?? summary.payments[0];

  // Find the current user's overall payment status
  const myPending = summary.myPendingPayments;
  const hasPending = myPending.length > 0;
  const allAuthorized = summary.payments.length > 0 &&
    summary.payments.every((p) => p.status === "AUTHORIZED" || p.status === "CAPTURED");

  // Get the active pending payment to show Elements for
  const activePendingPayment = myPending[0] ?? null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Payment Authorization
          </h3>
          {allAuthorized ? (
            <Badge className="bg-green-100 text-green-700">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              All Authorized
            </Badge>
          ) : hasPending ? (
            <Badge className="bg-amber-100 text-amber-700">
              <CreditCard className="mr-1 h-3 w-3" />
              Action Required
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Payment entries */}
          {summary.payments.map((payment, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-sm"
            >
              <div>
                <span className="text-gray-600">
                  User ...{payment.userId.slice(-4)}
                </span>
                <span className="ml-2 font-medium">
                  {formatPrice(payment.amountCents)}
                </span>
              </div>
              <PaymentStatusBadge status={payment.status} />
            </div>
          ))}

          {/* Divider */}
          {summary.payments.length > 0 && (hasPending || allAuthorized) && (
            <div className="border-t border-gray-100" />
          )}

          {/* All authorized state */}
          {allAuthorized && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2.5 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">All payments authorized</p>
                <p className="text-xs text-green-600">
                  Funds are held on each participant&apos;s card and will be
                  captured when the trade completes.
                </p>
              </div>
            </div>
          )}

          {/* Confirmed — waiting for webhook */}
          {confirmed && hasPending && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2.5 text-sm text-blue-700">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              <div>
                <p className="font-medium">Confirming authorization...</p>
                <p className="text-xs text-blue-600">
                  Waiting for payment confirmation. This usually takes a few seconds.
                </p>
              </div>
            </div>
          )}

          {/* Payment form for pending payments */}
          {!confirmed &&
            hasPending &&
            activePendingPayment?.clientSecret &&
            stripePromise && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">
                  Authorize a hold of{" "}
                  <span className="font-semibold text-gray-700">
                    {formatPrice(activePendingPayment.amountCents)}
                  </span>{" "}
                  on your card to secure this trade. You won&apos;t be charged
                  until the trade completes.
                </p>
                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret: activePendingPayment.clientSecret,
                    appearance: {
                      theme: "stripe",
                      variables: { colorPrimary: "#4f46e5" },
                    },
                  }}
                >
                  <PaymentForm
                    onSuccess={handlePaymentSuccess}
                    amountCents={activePendingPayment.amountCents}
                  />
                </Elements>
              </div>
            )}

          {/* No client secret but still pending — show message */}
          {!confirmed &&
            hasPending &&
            !activePendingPayment?.clientSecret && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">Payment setup in progress</p>
                  <p className="text-xs text-amber-600">
                    The payment authorization is being prepared. Please refresh in a moment.
                  </p>
                </div>
              </div>
            )}

          {/* Trade completed/cancelled — show final state */}
          {(tradeStatus === "COMPLETED" || tradeStatus === "CANCELLED") && (
            <div className="text-xs text-gray-400">
              {tradeStatus === "COMPLETED"
                ? "Payments have been captured and settled."
                : "Payment authorizations have been cancelled."}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
