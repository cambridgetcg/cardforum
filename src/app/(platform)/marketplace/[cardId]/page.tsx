"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IntentPanel } from "@/components/listings/intent-panel";
import { CardInsights } from "@/components/expert/card-insights";
import {
  formatPrice,
  CONDITION_LABELS,
  TCG_LABELS,
  TCG_BADGE_COLORS,
  type TCG,
  type Condition,
} from "@/types/domain";

interface AskLevel {
  price: number;
  totalQty: number;
  listings: number;
  conditions: Condition[];
}

interface BidLevel {
  price: number;
  totalQty: number;
  listings: number;
  minConditions: Condition[];
}

interface OrderBookData {
  card: {
    id: string;
    tcg: TCG;
    name: string;
    setName: string;
    setCode: string | null;
    number: string | null;
    rarity: string | null;
    imageUrl: string | null;
    set: { id: string; code: string; name: string } | null;
  };
  asks: AskLevel[];
  bids: BidLevel[];
  summary: {
    bestAsk: number | null;
    bestBid: number | null;
    spread: number | null;
    spreadPct: number | null;
    midpoint: number | null;
    totalAsks: number;
    totalBids: number;
  };
}

interface GradedAskLevel {
  price: number;
  totalQty: number;
  listings: number;
  grades: string[];
}

interface GradedBidLevel {
  price: number;
  totalQty: number;
  listings: number;
  gradeRanges: string[];
}

interface GradedOrderBook {
  asks: GradedAskLevel[];
  bids: GradedBidLevel[];
  summary: {
    bestAsk: number | null;
    bestBid: number | null;
    spread: number | null;
    spreadPct: number | null;
    midpoint: number | null;
    totalAsks: number;
    totalBids: number;
  };
}

export default function OrderBookPage() {
  const { cardId } = useParams<{ cardId: string }>();
  const [data, setData] = useState<OrderBookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intentType, setIntentType] = useState<"have" | "want" | null>(null);
  const [gradedData, setGradedData] = useState<GradedOrderBook | null>(null);
  const [showGraded, setShowGraded] = useState(false);

  useEffect(() => {
    if (!cardId) return;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
    Promise.all([
      fetch(`/api/orderbook?cardId=${cardId}`).then((res) => {
        if (!res.ok) throw new Error("Card not found");
        return res.json();
      }),
      fetch(`/api/orderbook/graded?cardId=${cardId}`)
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
    ])
      .then(([raw, graded]: [OrderBookData, GradedOrderBook | null]) => {
        setData(raw);
        setGradedData(graded);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [cardId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-sm text-gray-500">Loading order book...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Marketplace
        </Link>
        <p className="mt-4 text-gray-500">{error ?? "Card not found."}</p>
      </div>
    );
  }

  const { card, asks, bids, summary } = data;
  const maxRows = Math.max(asks.length, bids.length, 1);

  // Compute max quantity for depth bar visualization
  const allQtys = [...asks.map((a) => a.totalQty), ...bids.map((b) => b.totalQty)];
  const maxQty = Math.max(...allQtys, 1);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        href="/marketplace"
        className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Marketplace
      </Link>

      {/* Card header */}
      <div className="mt-4 flex gap-5">
        <div className="h-40 w-28 shrink-0 overflow-hidden rounded-lg bg-gray-100">
          {card.imageUrl ? (
            <img
              src={card.imageUrl}
              alt={card.name}
              className="h-full w-full object-contain"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-300">
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                />
              </svg>
            </div>
          )}
        </div>
        <div className="flex flex-col justify-center gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{card.name}</h1>
            <Badge variant={TCG_BADGE_COLORS[card.tcg]} className="text-[10px]">
              {TCG_LABELS[card.tcg]}
            </Badge>
          </div>
          <p className="text-sm text-gray-500">
            {card.set?.name ?? card.setName}
            {card.setCode && ` (${card.setCode})`}
            {card.number && ` #${card.number}`}
          </p>
          {card.rarity && <p className="text-xs text-gray-400">{card.rarity}</p>}
        </div>
      </div>

      {/* Summary bar */}
      <div className="mt-6 flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-3.5">
        <SummaryStat
          label="Best Bid"
          value={summary.bestBid != null ? formatPrice(summary.bestBid) : "--"}
          color="text-emerald-600"
        />
        <SummaryStat
          label="Best Ask"
          value={summary.bestAsk != null ? formatPrice(summary.bestAsk) : "--"}
          color="text-amber-600"
        />
        <SummaryStat
          label="Spread"
          value={summary.spread != null ? formatPrice(summary.spread) : "--"}
          sub={summary.spreadPct != null ? `${summary.spreadPct}%` : undefined}
          color="text-gray-700"
        />
        <SummaryStat
          label="Midpoint"
          value={summary.midpoint != null ? formatPrice(summary.midpoint) : "--"}
          color="text-indigo-600"
        />
        <SummaryStat
          label="Total Bids"
          value={String(summary.totalBids)}
          color="text-emerald-600"
        />
        <SummaryStat label="Total Asks" value={String(summary.totalAsks)} color="text-amber-600" />
      </div>

      {/* Listing actions */}
      <div className="mt-4 flex gap-3">
        <Button variant="primary" size="sm" onClick={() => setIntentType("have")}>
          Sell This Card
        </Button>
        <Button variant="outline" size="sm" onClick={() => setIntentType("want")}>
          Buy This Card
        </Button>
      </div>

      {/* Order Book Depth Table */}
      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <h2 className="border-b border-gray-100 px-5 py-3 text-sm font-semibold text-gray-900">
          Order Book Depth
        </h2>

        {asks.length === 0 && bids.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">
            No active listings for this card.
          </div>
        ) : (
          <div className="grid grid-cols-2 divide-x divide-gray-100">
            {/* Bids (left side) — sorted best to worst (high to low) */}
            <div>
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-b border-gray-100 px-4 py-2 text-xs font-medium text-gray-500">
                <span>Condition</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Bid</span>
              </div>
              {Array.from({ length: maxRows }).map((_, i) => {
                const bid = bids[i];
                if (!bid) return <div key={`bid-${i}`} className="h-9" />;
                const depthPct = (bid.totalQty / maxQty) * 100;
                return (
                  <div
                    key={`bid-${i}`}
                    className="relative grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-4 py-1.5"
                  >
                    <div
                      className="absolute inset-y-0 right-0 bg-emerald-50"
                      style={{ width: `${depthPct}%` }}
                    />
                    <span className="relative z-10 text-xs text-gray-500">
                      {bid.minConditions
                        .map((c) => CONDITION_LABELS[c as Condition] ?? c)
                        .join(", ")}
                    </span>
                    <span className="relative z-10 text-right text-sm text-gray-700 tabular-nums">
                      {bid.totalQty}
                    </span>
                    <span className="relative z-10 text-right text-sm font-semibold text-emerald-600 tabular-nums">
                      {formatPrice(bid.price)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Asks (right side) — sorted best to worst (low to high) */}
            <div>
              <div className="grid grid-cols-[auto_auto_1fr] gap-x-3 border-b border-gray-100 px-4 py-2 text-xs font-medium text-gray-500">
                <span>Ask</span>
                <span>Qty</span>
                <span className="text-right">Condition</span>
              </div>
              {Array.from({ length: maxRows }).map((_, i) => {
                const ask = asks[i];
                if (!ask) return <div key={`ask-${i}`} className="h-9" />;
                const depthPct = (ask.totalQty / maxQty) * 100;
                return (
                  <div
                    key={`ask-${i}`}
                    className="relative grid grid-cols-[auto_auto_1fr] items-center gap-x-3 px-4 py-1.5"
                  >
                    <div
                      className="absolute inset-y-0 left-0 bg-amber-50"
                      style={{ width: `${depthPct}%` }}
                    />
                    <span className="relative z-10 text-sm font-semibold text-amber-600 tabular-nums">
                      {formatPrice(ask.price)}
                    </span>
                    <span className="relative z-10 text-sm text-gray-700 tabular-nums">
                      {ask.totalQty}
                    </span>
                    <span className="relative z-10 text-right text-xs text-gray-500">
                      {ask.conditions.map((c) => CONDITION_LABELS[c as Condition] ?? c).join(", ")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Graded Order Book */}
      {gradedData && (gradedData.asks.length > 0 || gradedData.bids.length > 0) && (
        <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <button
            onClick={() => setShowGraded(!showGraded)}
            className="flex w-full items-center justify-between border-b border-gray-100 px-5 py-3 text-left"
          >
            <span className="text-sm font-semibold text-gray-900">
              Graded Order Book
              <span className="ml-2 text-xs font-normal text-gray-400">
                {gradedData.summary.totalAsks} asks / {gradedData.summary.totalBids} bids
              </span>
            </span>
            <span className="text-xs text-gray-400">{showGraded ? "Hide" : "Show"}</span>
          </button>
          {showGraded && (
            <>
              <div className="flex flex-wrap items-center gap-4 border-b border-gray-100 px-5 py-2.5">
                <SummaryStat
                  label="Best Bid"
                  value={
                    gradedData.summary.bestBid != null
                      ? formatPrice(gradedData.summary.bestBid)
                      : "--"
                  }
                  color="text-emerald-600"
                />
                <SummaryStat
                  label="Best Ask"
                  value={
                    gradedData.summary.bestAsk != null
                      ? formatPrice(gradedData.summary.bestAsk)
                      : "--"
                  }
                  color="text-amber-600"
                />
                <SummaryStat
                  label="Spread"
                  value={
                    gradedData.summary.spread != null
                      ? formatPrice(gradedData.summary.spread)
                      : "--"
                  }
                  sub={
                    gradedData.summary.spreadPct != null
                      ? `${gradedData.summary.spreadPct}%`
                      : undefined
                  }
                  color="text-gray-700"
                />
              </div>
              <GradedDepthTable asks={gradedData.asks} bids={gradedData.bids} />
            </>
          )}
        </div>
      )}

      {/* Expert Insights */}
      <div className="mt-6">
        <CardInsights cardId={cardId} />
      </div>

      {/* Intent Panel */}
      {data && (
        <IntentPanel
          open={intentType !== null}
          card={{
            id: card.id,
            tcg: card.tcg,
            name: card.name,
            setName: card.setName,
            setCode: card.setCode,
            number: card.number,
            imageUrl: card.imageUrl,
          }}
          type={intentType ?? "have"}
          onClose={() => setIntentType(null)}
          onCreated={() => {
            setIntentType(null);
            // Refetch order book
            fetch(`/api/orderbook?cardId=${cardId}`)
              .then((res) => res.json())
              .then((d: OrderBookData) => setData(d))
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] tracking-wide text-gray-400 uppercase">{label}</span>
      <span className={`text-lg font-bold tabular-nums ${color}`}>
        {value}
        {sub && <span className="ml-1 text-xs font-normal text-gray-400">({sub})</span>}
      </span>
    </div>
  );
}

function GradedDepthTable({ asks, bids }: { asks: GradedAskLevel[]; bids: GradedBidLevel[] }) {
  const maxRows = Math.max(asks.length, bids.length, 1);
  const allQtys = [...asks.map((a) => a.totalQty), ...bids.map((b) => b.totalQty)];
  const maxQty = Math.max(...allQtys, 1);

  return (
    <div className="grid grid-cols-2 divide-x divide-gray-100">
      {/* Bids */}
      <div>
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-b border-gray-100 px-4 py-2 text-xs font-medium text-gray-500">
          <span>Grade Range</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Bid</span>
        </div>
        {Array.from({ length: maxRows }).map((_, i) => {
          const bid = bids[i];
          if (!bid) return <div key={`gbid-${i}`} className="h-9" />;
          const depthPct = (bid.totalQty / maxQty) * 100;
          return (
            <div
              key={`gbid-${i}`}
              className="relative grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-4 py-1.5"
            >
              <div
                className="absolute inset-y-0 right-0 bg-emerald-50"
                style={{ width: `${depthPct}%` }}
              />
              <span className="relative z-10 text-xs text-gray-500">
                {bid.gradeRanges.join(", ")}
              </span>
              <span className="relative z-10 text-right text-sm text-gray-700 tabular-nums">
                {bid.totalQty}
              </span>
              <span className="relative z-10 text-right text-sm font-semibold text-emerald-600 tabular-nums">
                {formatPrice(bid.price)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Asks */}
      <div>
        <div className="grid grid-cols-[auto_auto_1fr] gap-x-3 border-b border-gray-100 px-4 py-2 text-xs font-medium text-gray-500">
          <span>Ask</span>
          <span>Qty</span>
          <span className="text-right">Grade</span>
        </div>
        {Array.from({ length: maxRows }).map((_, i) => {
          const ask = asks[i];
          if (!ask) return <div key={`gask-${i}`} className="h-9" />;
          const depthPct = (ask.totalQty / maxQty) * 100;
          return (
            <div
              key={`gask-${i}`}
              className="relative grid grid-cols-[auto_auto_1fr] items-center gap-x-3 px-4 py-1.5"
            >
              <div
                className="absolute inset-y-0 left-0 bg-amber-50"
                style={{ width: `${depthPct}%` }}
              />
              <span className="relative z-10 text-sm font-semibold text-amber-600 tabular-nums">
                {formatPrice(ask.price)}
              </span>
              <span className="relative z-10 text-sm text-gray-700 tabular-nums">
                {ask.totalQty}
              </span>
              <span className="relative z-10 text-right text-xs text-gray-500">
                {ask.grades.join(", ")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
