"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TCG_LABELS, TCG_FILTERS, TCG_BADGE_COLORS, formatPrice, type TCG } from "@/types/domain";

interface MarketCard {
  id: string;
  tcg: TCG;
  name: string;
  setName: string;
  setCode: string | null;
  number: string | null;
  rarity: string | null;
  imageUrl: string | null;
  set: { id: string; code: string; name: string } | null;
  market: {
    bestAsk: number | null;
    bestBid: number | null;
    askCount: number;
    bidCount: number;
    spread: number | null;
    spreadPct: number | null;
  };
}

interface MarketResponse {
  cards: MarketCard[];
  total: number;
  page: number;
  totalPages: number;
}

interface CardSetOption {
  id: string;
  code: string;
  name: string;
  tcg: TCG;
  _count: { cards: number };
}

export default function MarketplacePage() {
  const [query, setQuery] = useState("");
  const [tcgFilter, setTcgFilter] = useState<TCG | "">("");
  const [setFilter, setSetFilter] = useState("");
  const [sets, setSets] = useState<CardSetOption[]>([]);
  const [results, setResults] = useState<MarketResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  // Fetch sets for dropdown
  useEffect(() => {
    const params = new URLSearchParams();
    if (tcgFilter) params.set("tcg", tcgFilter);
    fetch(`/api/card-sets?${params}`)
      .then((res) => res.json())
      .then((data: { sets: CardSetOption[] }) => setSets(data.sets))
      .catch(() => setSets([]));
  }, [tcgFilter]);

  useEffect(() => {
    setSetFilter("");
  }, [tcgFilter]);

  const search = useCallback(async (q: string, tcg: TCG | "", set: string, p: number) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("query", q);
    if (tcg) params.set("tcg", tcg);
    if (set) params.set("set", set);
    params.set("page", String(p));
    params.set("limit", "20");

    try {
      const res = await fetch(`/api/marketplace?${params}`);
      const data: MarketResponse = await res.json();
      setResults(data);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    const timer = setTimeout(() => search(query, tcgFilter, setFilter, 1), 300);
    return () => clearTimeout(timer);
  }, [query, tcgFilter, setFilter, search]);

  useEffect(() => {
    if (page > 1) search(query, tcgFilter, setFilter, page);
  }, [page, query, tcgFilter, setFilter, search]);

  useEffect(() => {
    search("", "", "", 1);
  }, [search]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">Marketplace</h1>
      <p className="mt-1 text-sm text-gray-600">
        Live bid/ask prices from active listings
      </p>

      <div className="mt-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search cards..."
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              {TCG_FILTERS.map((f) => (
                <Button
                  key={f.value}
                  variant={tcgFilter === f.value ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setTcgFilter(f.value as TCG | "")}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>

          {sets.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Set:</span>
              <select
                value={setFilter}
                onChange={(e) => setSetFilter(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-300"
              >
                <option value="">All Sets</option>
                {sets.map((s) => (
                  <option key={s.id} value={s.code}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {loading && <p className="text-sm text-gray-500">Loading market data...</p>}

        {results && !loading && (
          <>
            <p className="text-sm text-gray-500">
              {results.total} card{results.total !== 1 ? "s" : ""} with active listings
            </p>

            {results.cards.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
                <p className="text-gray-500">No active listings found.</p>
                <p className="mt-1 text-sm text-gray-400">
                  Cards appear here when someone creates a have or want listing.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {results.cards.map((card) => (
                  <Link key={card.id} href={`/marketplace/${card.id}`} className="block transition-shadow hover:shadow-md rounded-xl">
                    <MarketCard card={card} />
                  </Link>
                ))}
              </div>
            )}

            {results.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600">
                  Page {results.page} of {results.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= results.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MarketCard({ card }: { card: MarketCard }) {
  const { market } = card;
  const hasBothSides = market.bestBid != null && market.bestAsk != null;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* Card image */}
      <div className="relative aspect-[5/7] w-full bg-gray-100">
        {card.imageUrl ? (
          <img
            src={card.imageUrl}
            alt={card.name}
            className="h-full w-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300">
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
            </svg>
          </div>
        )}
      </div>

      {/* Card info */}
      <div className="flex flex-col gap-1.5 p-3">
        <div className="flex items-start justify-between gap-1">
          <h3 className="text-sm font-semibold leading-tight text-gray-900 line-clamp-2">
            {card.name}
          </h3>
          <Badge variant={TCG_BADGE_COLORS[card.tcg]} className="shrink-0 text-[10px]">
            {TCG_LABELS[card.tcg]}
          </Badge>
        </div>
        <p className="text-xs text-gray-500">
          {card.set?.name ?? card.setName}
          {card.setCode && ` (${card.setCode})`}
        </p>

        {/* Bid/Ask spread */}
        <div className="mt-1 rounded-lg bg-gray-50 px-2.5 py-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Bid</span>
            <span className="text-gray-500">Ask</span>
          </div>
          <div className="flex items-center justify-between">
            {market.bestBid != null ? (
              <span className="text-sm font-semibold text-emerald-600">
                {formatPrice(market.bestBid)}
              </span>
            ) : (
              <span className="text-xs text-gray-300">--</span>
            )}
            {hasBothSides && market.spread != null && (
              <span className="text-[10px] text-gray-400">
                {market.spreadPct != null && market.spreadPct > 0
                  ? `${market.spreadPct}%`
                  : "0%"}
              </span>
            )}
            {market.bestAsk != null ? (
              <span className="text-sm font-semibold text-amber-600">
                {formatPrice(market.bestAsk)}
              </span>
            ) : (
              <span className="text-xs text-gray-300">--</span>
            )}
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400">
            <span>{market.bidCount} bid{market.bidCount !== 1 ? "s" : ""}</span>
            <span>{market.askCount} ask{market.askCount !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
