"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowDownToLine, Link2, Loader2, CheckCircle } from "lucide-react";

interface WithdrawFormProps {
  balance: number; // cents
  connectReady: boolean;
  hasConnectAccount: boolean;
  onSuccess: () => void;
}

export function WithdrawForm({
  balance,
  connectReady,
  hasConnectAccount,
  onSuccess,
}: WithdrawFormProps) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [onboarding, setOnboarding] = useState(false);
  const [pollingConnect, setPollingConnect] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for Connect onboarding completion when user returns from Stripe
  useEffect(() => {
    if (!pollingConnect) return;
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts >= 30) {
        // Give up after 60s
        if (pollRef.current) clearInterval(pollRef.current);
        setPollingConnect(false);
        return;
      }
      try {
        const res = await fetch("/api/connect/status");
        if (res.ok) {
          const data = await res.json();
          if (data.onboardingComplete) {
            if (pollRef.current) clearInterval(pollRef.current);
            setPollingConnect(false);
            onSuccess(); // Refresh page data
          }
        }
      } catch { /* ignore */ }
    }, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [pollingConnect, onSuccess]);

  async function handleOnboard() {
    setError("");
    setOnboarding(true);
    try {
      const res = await fetch("/api/connect/onboard", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to start onboarding");
        setOnboarding(false);
        return;
      }
      // Open Stripe onboarding in new window, poll for completion
      window.open(data.url, "_blank");
      setPollingConnect(true);
      setOnboarding(false);
    } catch {
      setError("Failed to start onboarding");
      setOnboarding(false);
    }
  }

  async function handleWithdraw() {
    // If not connected, trigger onboarding first
    if (!connectReady) {
      handleOnboard();
      return;
    }

    setError("");
    const dollars = parseFloat(amount);
    if (isNaN(dollars) || dollars < 10) {
      setError("Minimum withdrawal is $10.00");
      return;
    }

    const cents = Math.round(dollars * 100);
    if (cents > balance) {
      setError("Insufficient balance");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: cents }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Withdrawal failed");
        return;
      }

      setAmount("");
      onSuccess();
    } catch {
      setError("Withdrawal failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">Withdraw Funds</h3>

      {pollingConnect && (
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          Waiting for bank account setup to complete...
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
          <Input
            type="number"
            min="10"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="pl-7"
            disabled={!connectReady}
          />
        </div>
        <Button
          variant="outline"
          onClick={handleWithdraw}
          disabled={loading || onboarding || pollingConnect}
        >
          {!connectReady ? (
            <>
              <Link2 className="mr-1 h-4 w-4" />
              {onboarding ? "Opening..." : hasConnectAccount ? "Finish Setup" : "Set Up & Withdraw"}
            </>
          ) : (
            <>
              <ArrowDownToLine className="mr-1 h-4 w-4" />
              {loading ? "Processing..." : "Withdraw"}
            </>
          )}
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {connectReady ? (
        <p className="text-xs text-gray-400">
          Min $10 &middot; Sent to your connected bank account (1-3 business days)
        </p>
      ) : (
        <p className="text-xs text-amber-600">
          {hasConnectAccount
            ? "Complete your bank setup to withdraw funds."
            : "Click to set up your bank account — you can withdraw immediately after."}
        </p>
      )}
    </div>
  );
}
