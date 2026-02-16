"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { fromMinorUnits, getCurrencyExponent, CURRENCY_INFO, type SupportedCurrency } from "@/lib/currency";

interface MarketData {
  suggestedAsk: number | null;
  suggestedBid: number | null;
  market: {
    bestAsk: number | null;
    bestBid: number | null;
    askCount: number;
    bidCount: number;
  };
}

interface MarketContextCardProps {
  cardId: string | null;
  condition: string;
  type: "have" | "want";
  /** User's current price in minor units (null if not yet entered) */
  userPriceMinor: number | null;
  currency: SupportedCurrency;
  onApplySuggestion: (priceDisplay: string) => void;
}

function formatCurrencyPrice(minorUnits: number, currency: SupportedCurrency): string {
  const symbol = CURRENCY_INFO[currency]?.symbol ?? currency;
  const isZeroDecimal = getCurrencyExponent(currency) === 0;
  const display = fromMinorUnits(minorUnits, currency);
  return `${symbol}${display.toFixed(isZeroDecimal ? 0 : 2)}`;
}

export function MarketContextCard({
  cardId,
  condition,
  type,
  userPriceMinor,
  currency,
  onApplySuggestion,
}: MarketContextCardProps) {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!cardId) return;
    setLoading(true);
    setData(null);
    fetch(`/api/marketplace/price-suggestion?cardId=${cardId}&condition=${condition}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [cardId, condition]);

  if (!cardId) return null;

  if (loading) {
    return (
      <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
        <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
        <div className="mt-2 h-3 w-48 animate-pulse rounded bg-gray-200" />
      </div>
    );
  }

  if (!data) return null;

  const suggestedPrice = type === "have" ? data.suggestedAsk : data.suggestedBid;
  const bestAsk = data.market.bestAsk;
  const bestBid = data.market.bestBid;
  const hasMarketData = bestAsk != null || bestBid != null;

  // Positioning intelligence
  let positionText = "";
  let positionIcon: React.ReactNode = null;

  if (userPriceMinor != null && hasMarketData) {
    if (type === "have") {
      if (bestAsk == null) {
        positionText = "You'll set the first ask price for this card.";
        positionIcon = <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />;
      } else if (userPriceMinor < bestAsk) {
        positionText = `Your price is the new best ask! Expect fast matching.`;
        positionIcon = <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />;
      } else if (userPriceMinor === bestAsk) {
        positionText = "Your price matches the current best ask.";
        positionIcon = <Minus className="h-3.5 w-3.5 text-gray-500" />;
      } else {
        positionText = `Above the best ask (${formatCurrencyPrice(bestAsk, currency)}). Consider lowering for faster matching.`;
        positionIcon = <TrendingDown className="h-3.5 w-3.5 text-amber-600" />;
      }
    } else {
      if (bestBid == null) {
        positionText = "You'll set the first bid for this card.";
        positionIcon = <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />;
      } else if (userPriceMinor > bestBid) {
        positionText = `Your bid is the new highest! Expect fast matching.`;
        positionIcon = <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />;
      } else if (userPriceMinor === bestBid) {
        positionText = "Your bid matches the current best bid.";
        positionIcon = <Minus className="h-3.5 w-3.5 text-gray-500" />;
      } else {
        positionText = `Below the current best bid (${formatCurrencyPrice(bestBid, currency)}). Consider raising for faster matching.`;
        positionIcon = <TrendingDown className="h-3.5 w-3.5 text-amber-600" />;
      }
    }

    // Check for immediate match opportunity
    if (bestAsk != null && bestBid != null) {
      if (type === "have" && userPriceMinor <= bestBid) {
        positionText = "Immediate match opportunity! A trade should form automatically.";
        positionIcon = <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />;
      } else if (type === "want" && userPriceMinor >= bestAsk) {
        positionText = "Immediate match opportunity! A trade should form automatically.";
        positionIcon = <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />;
      }
    }
  }

  const isZeroDecimal = getCurrencyExponent(currency) === 0;

  return (
    <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Market Snapshot</p>

      {/* Suggested price */}
      {suggestedPrice != null && (
        <div className="mt-2 flex items-center gap-2 text-emerald-800">
          <TrendingUp className="h-3.5 w-3.5 flex-shrink-0" />
          <span>
            Suggested:{" "}
            <button
              type="button"
              className="font-semibold underline decoration-dotted hover:text-emerald-900"
              onClick={() => {
                const display = fromMinorUnits(suggestedPrice, currency);
                onApplySuggestion(display.toFixed(isZeroDecimal ? 0 : 2));
              }}
            >
              {formatCurrencyPrice(suggestedPrice, currency)}
            </button>
          </span>
        </div>
      )}

      {/* Best bid/ask */}
      {hasMarketData && (
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
          <div>
            Best ask:{" "}
            <span className="font-medium text-amber-700">
              {bestAsk != null ? formatCurrencyPrice(bestAsk, currency) : "---"}
            </span>
            {data.market.askCount > 0 && (
              <span className="text-gray-400"> ({data.market.askCount})</span>
            )}
          </div>
          <div>
            Best bid:{" "}
            <span className="font-medium text-emerald-700">
              {bestBid != null ? formatCurrencyPrice(bestBid, currency) : "---"}
            </span>
            {data.market.bidCount > 0 && (
              <span className="text-gray-400"> ({data.market.bidCount})</span>
            )}
          </div>
        </div>
      )}

      {/* No data */}
      {!hasMarketData && suggestedPrice == null && (
        <p className="mt-2 text-xs text-gray-500">
          No market data yet. You'll be the first to list this card at this condition.
        </p>
      )}

      {/* Positioning intelligence */}
      {positionText && (
        <div className="mt-2 flex items-start gap-1.5 border-t border-gray-200 pt-2 text-xs text-gray-600">
          {positionIcon}
          <span>{positionText}</span>
        </div>
      )}
    </div>
  );
}
