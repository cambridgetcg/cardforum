"use client";

import { useState, useEffect, useCallback } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TCG_LABELS, type TCG } from "@/types/domain";

interface CardResult {
  id: string;
  tcg: TCG;
  name: string;
  setName: string;
  setCode: string | null;
  number: string | null;
  rarity: string | null;
}

interface CardSearchResponse {
  cards: CardResult[];
  total: number;
  page: number;
  totalPages: number;
}

const TCG_FILTERS: { value: TCG | ""; label: string }[] = [
  { value: "", label: "All TCGs" },
  { value: "POKEMON", label: "Pokemon" },
  { value: "ONEPIECE", label: "One Piece" },
  { value: "YUGIOH", label: "Yu-Gi-Oh!" },
  { value: "MTG", label: "Magic" },
];

const TCG_BADGE_COLORS: Record<TCG, "default" | "success" | "warning" | "error" | "info"> = {
  POKEMON: "warning",
  ONEPIECE: "error",
  YUGIOH: "info",
  MTG: "success",
};

export function CardSearch({
  onSelect,
  mode = "browse",
}: {
  onSelect?: (card: CardResult) => void;
  mode?: "browse" | "select";
}) {
  const [query, setQuery] = useState("");
  const [tcgFilter, setTcgFilter] = useState<TCG | "">("");
  const [results, setResults] = useState<CardSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const search = useCallback(async (q: string, tcg: TCG | "", p: number) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("query", q);
    if (tcg) params.set("tcg", tcg);
    params.set("page", String(p));
    params.set("limit", "20");

    try {
      const res = await fetch(`/api/cards?${params}`);
      const data: CardSearchResponse = await res.json();
      setResults(data);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search on query/filter change
  useEffect(() => {
    setPage(1);
    const timer = setTimeout(() => search(query, tcgFilter, 1), 300);
    return () => clearTimeout(timer);
  }, [query, tcgFilter, search]);

  // Immediate search on page change
  useEffect(() => {
    if (page > 1) search(query, tcgFilter, page);
  }, [page, query, tcgFilter, search]);

  // Load initial results
  useEffect(() => {
    search("", "", 1);
  }, [search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cards by name, set, or code..."
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

      {loading && (
        <p className="text-sm text-gray-500">Searching...</p>
      )}

      {results && !loading && (
        <>
          <p className="text-sm text-gray-500">
            {results.total} card{results.total !== 1 ? "s" : ""} found
          </p>

          {results.cards.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
              <p className="text-gray-500">No cards found. Try a different search.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {results.cards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => onSelect?.(card)}
                  className={`flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 text-left transition-colors ${
                    onSelect
                      ? "cursor-pointer hover:border-indigo-300 hover:bg-indigo-50"
                      : "cursor-default"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-gray-900">{card.name}</h3>
                    <Badge variant={TCG_BADGE_COLORS[card.tcg]}>
                      {TCG_LABELS[card.tcg]}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">
                    {card.setName}
                    {card.setCode && ` (${card.setCode})`}
                    {card.number && ` #${card.number}`}
                  </p>
                  {card.rarity && (
                    <p className="text-xs text-gray-400">{card.rarity}</p>
                  )}
                </button>
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
  );
}
