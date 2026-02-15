"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, CreditCard, Building2 } from "lucide-react";

type PaymentMethod = "card" | "ach";

export function DepositButton() {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("ach");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDeposit() {
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
      const res = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: Math.round(dollars * 100),
          paymentMethod: method,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to start deposit");
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Failed to start deposit");
    } finally {
      setLoading(false);
    }
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
            <div className="text-xs opacity-75">3–5 days</div>
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
        <Button onClick={handleDeposit} disabled={loading}>
          <Plus className="mr-1 h-4 w-4" />
          {loading ? "Redirecting..." : "Deposit"}
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-gray-400">
        Min $5 &middot; Max $10,000 &middot;{" "}
        {method === "ach"
          ? "Bank transfer settles in 3–5 business days"
          : "Card payment is instant"}
      </p>
    </div>
  );
}
