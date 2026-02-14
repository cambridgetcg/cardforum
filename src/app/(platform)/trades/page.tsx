"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TradeCard } from "@/components/trades/trade-card";
import type { TradeStatus } from "@/types/domain";

interface TradeLeg {
  id: string;
  fromUserId: string;
  toUserId: string;
  region: string;
  status: string;
  sequence: number;
}

interface Trade {
  id: string;
  status: TradeStatus;
  createdAt: string;
  updatedAt: string;
  userAId: string;
  userBId: string;
  legs: TradeLeg[];
}

export default function TradesPage() {
  const { data: session } = useSession();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchingStatus, setMatchingStatus] = useState("");

  const fetchTrades = useCallback(async () => {
    try {
      const res = await fetch("/api/trades");
      if (res.ok) {
        const data = await res.json();
        setTrades(data.trades);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  async function handleRunMatching() {
    setMatchingStatus("Running...");
    try {
      const res = await fetch("/api/matches", { method: "POST" });
      const data = await res.json();
      setMatchingStatus(data.message || "Done");
      fetchTrades();
    } catch {
      setMatchingStatus("Failed to run matching");
    }
  }

  async function handleTradeAction(tradeId: string, action: "accept" | "reject" | "cancel") {
    await fetch("/api/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tradeId, action }),
    });
    fetchTrades();
  }

  const activeTrades = trades.filter(
    (t) => !["COMPLETED", "REJECTED", "CANCELLED"].includes(t.status)
  );
  const completedTrades = trades.filter((t) =>
    ["COMPLETED", "REJECTED", "CANCELLED"].includes(t.status)
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-gray-500">Loading trades...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trades</h1>
          <p className="mt-1 text-sm text-gray-600">
            View and manage your active trades
          </p>
        </div>
        <div className="flex items-center gap-3">
          {matchingStatus && (
            <span className="text-sm text-gray-500">{matchingStatus}</span>
          )}
          <Button variant="outline" onClick={handleRunMatching}>
            Find Matches
          </Button>
        </div>
      </div>

      {/* Active Trades */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Active ({activeTrades.length})
        </h2>
        {activeTrades.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">
                No active trades. When the matching engine finds a bridge for your
                listings, trade proposals will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {activeTrades.map((trade) => (
              <TradeCard
                key={trade.id}
                {...trade}
                currentUserId={session?.user?.id ?? ""}
                onAction={handleTradeAction}
              />
            ))}
          </div>
        )}
      </div>

      {/* Completed Trades */}
      {completedTrades.length > 0 && (
        <div className="mt-12">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            History ({completedTrades.length})
          </h2>
          <div className="space-y-4">
            {completedTrades.map((trade) => (
              <TradeCard
                key={trade.id}
                {...trade}
                currentUserId={session?.user?.id ?? ""}
                onAction={handleTradeAction}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
