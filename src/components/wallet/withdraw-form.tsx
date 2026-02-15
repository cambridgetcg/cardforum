"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowDownToLine } from "lucide-react";

interface WithdrawFormProps {
  balance: number; // cents
  connectReady: boolean;
  onSuccess: () => void;
}

export function WithdrawForm({ balance, connectReady, onSuccess }: WithdrawFormProps) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleWithdraw() {
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
          />
        </div>
        <Button variant="outline" onClick={handleWithdraw} disabled={loading || !connectReady}>
          <ArrowDownToLine className="mr-1 h-4 w-4" />
          {loading ? "Processing..." : "Withdraw"}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!connectReady && (
        <p className="text-sm text-amber-600">Connect your bank account to enable withdrawals.</p>
      )}
      <p className="text-xs text-gray-400">
        Min $10 &middot; {connectReady ? "Automatic payout to your bank account" : "Manual payout processing (1-3 business days)"}
      </p>
    </div>
  );
}
