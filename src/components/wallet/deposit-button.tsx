"use client";

import { useState, useCallback, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, CreditCard, Building2, CheckCircle2, Loader2 } from "lucide-react";

type PaymentMethod = "card" | "ach";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

function InlinePaymentForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
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
        return_url: `${window.location.origin}/wallet?deposit=success`,
      },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed");
      setProcessing(false);
    } else {
      onSuccess();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={!stripe || processing} className="flex-1">
          {processing ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Confirm Payment"
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={processing}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function DepositButton({ onDeposited }: { onDeposited?: () => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("ach");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [polling, setPolling] = useState(false);

  // After successful inline payment, poll for balance update
  const pollBalance = useCallback(() => {
    setPolling(true);
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts >= 15) {
        clearInterval(interval);
        setPolling(false);
        onDeposited?.();
        return;
      }
      try {
        const res = await fetch("/api/wallet/balance");
        if (res.ok) {
          onDeposited?.();
        }
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [onDeposited]);

  async function handleStartDeposit() {
    setError("");
    const dollars = parseFloat(amount);
    if (isNaN(dollars) || dollars < 5) {
      setError("Minimum deposit is $5.00");
      return;
    }
    if (dollars > 10_000) {
      setError("Maximum deposit is $10,000.00");
      return;
    }

    setLoading(true);
    try {
      // For ACH, still use Checkout redirect (ACH requires hosted flow for bank selection)
      if (method === "ach") {
        const res = await fetch("/api/wallet/deposit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amountCents: Math.round(dollars * 100),
            paymentMethod: "ach",
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(typeof data.error === "string" ? data.error : "Failed to start deposit");
          return;
        }
        window.location.href = data.url;
        return;
      }

      // For card, create PaymentIntent and show inline Elements
      const res = await fetch("/api/wallet/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: Math.round(dollars * 100),
          paymentMethod: "card",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to create payment");
        return;
      }
      setClientSecret(data.clientSecret);
    } catch {
      setError("Failed to start deposit");
    } finally {
      setLoading(false);
    }
  }

  function handleInlineSuccess() {
    setClientSecret(null);
    setSuccess(true);
    setAmount("");
    pollBalance();
    // Reset success message after 5s
    setTimeout(() => setSuccess(false), 5000);
  }

  // Show success state
  if (success) {
    return (
      <div className="space-y-3 rounded-xl border border-green-200 bg-green-50 p-6 shadow-sm">
        <div className="flex items-center gap-2 text-green-700">
          <CheckCircle2 className="h-5 w-5" />
          <h3 className="text-sm font-semibold">Deposit Successful</h3>
        </div>
        <p className="text-sm text-green-600">
          {polling ? "Updating your balance..." : "Your balance has been updated."}
        </p>
      </div>
    );
  }

  // Show inline Stripe Elements form
  if (clientSecret && stripePromise) {
    return (
      <div className="space-y-3 rounded-xl border border-indigo-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">
          Card Payment — ${parseFloat(amount).toFixed(2)}
        </h3>
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: { theme: "stripe", variables: { colorPrimary: "#4f46e5" } },
          }}
        >
          <InlinePaymentForm
            onSuccess={handleInlineSuccess}
            onCancel={() => setClientSecret(null)}
          />
        </Elements>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">Add Funds</h3>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMethod("ach")}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
            method === "ach"
              ? "border-indigo-500 bg-indigo-50 text-indigo-700"
              : "border-gray-200 text-gray-600 hover:border-gray-300"
          }`}
        >
          <Building2 className="h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">Bank Transfer</div>
            <div className="text-xs opacity-75">3-5 days</div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setMethod("card")}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
            method === "card"
              ? "border-indigo-500 bg-indigo-50 text-indigo-700"
              : "border-gray-200 text-gray-600 hover:border-gray-300"
          }`}
        >
          <CreditCard className="h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">Card</div>
            <div className="text-xs opacity-75">Instant</div>
          </div>
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
          <Input
            type="number"
            min="5"
            max="10000"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="pl-7"
          />
        </div>
        <Button onClick={handleStartDeposit} disabled={loading}>
          <Plus className="mr-1 h-4 w-4" />
          {loading ? "Loading..." : "Deposit"}
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-gray-400">
        Min $5 &middot; Max $10,000 &middot;{" "}
        {method === "ach"
          ? "Bank transfer settles in 3-5 business days"
          : "Card payment completes instantly inline"}
      </p>
    </div>
  );
}
