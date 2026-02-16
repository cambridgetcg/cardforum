"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface DeliveryConfirmationProps {
  tradeId: string;
  legId: string;
  cardName: string;
  onConfirmed: () => void;
}

export function DeliveryConfirmation({
  tradeId,
  legId,
  cardName,
  onConfirmed,
}: DeliveryConfirmationProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/trades/${tradeId}/legs/${legId}/deliver`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to confirm delivery");
      }

      onConfirmed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2">
      <div>
        <p className="text-sm font-medium text-green-800">Did you receive {cardName}?</p>
        <p className="text-xs text-green-600">
          Confirming delivery will complete this leg of the trade
        </p>
      </div>
      <div className="flex items-center gap-2">
        {error && <span className="text-xs text-red-600">{error}</span>}
        <Button
          size="sm"
          onClick={handleConfirm}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700"
        >
          {loading ? "Confirming..." : "Confirm Received"}
        </Button>
      </div>
    </div>
  );
}
