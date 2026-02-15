"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface RecordShipmentProps {
  tradeId: string;
  legId: string;
  cardName: string;
  role: "authenticator" | "sender";
  onRecorded: () => void;
}

export function RecordShipment({
  tradeId,
  legId,
  cardName,
  role,
  onRecorded,
}: RecordShipmentProps) {
  const [tracking, setTracking] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (tracking.length < 5) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/trades/${tradeId}/legs/${legId}/ship`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingNumber: tracking }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to record shipment");
      }

      onRecorded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2"
    >
      <div className="flex-1">
        <p className="mb-1 text-sm font-medium text-blue-800">
          Ship {cardName} to recipient
        </p>
        <p className="mb-2 text-xs text-blue-600">
          {role === "authenticator"
            ? "Enter the outbound tracking number after shipping"
            : "Enter the tracking number after shipping your card"}
        </p>
        <Input
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          placeholder="Tracking number"
          className="bg-white"
        />
      </div>
      <div>
        {error && <p className="mb-1 text-xs text-red-600">{error}</p>}
        <Button
          type="submit"
          size="sm"
          disabled={loading || tracking.length < 5}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {loading ? "Recording..." : "Mark Shipped"}
        </Button>
      </div>
    </form>
  );
}
