"use client";

import { useState, useEffect, useCallback } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TCG_LABELS, type TCG } from "@/types/domain";

interface CardSetInfo {
  id: string;
  code: string;
  name: string;
  productType: string | null;
}

interface CardResult {
  id: string;
  tcg: TCG;
  name: string;
  setName: string;
  setCode: string | null;
  number: string | null;
  rarity: string | null;
  imageUrl: string | null;
  set: CardSetInfo | null;
  _count: { variants: number };
}

interface CardSearchResponse {
  cards: CardResult[];
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
  const [setFilter, setSetFilter] = useState("");
  const [sets, setSets] = useState<CardSetOption[]>([]);
  const [results, setResults] = useState<CardSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  // Fetch available sets when TCG filter changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (tcgFilter) params.set("tcg", tcgFilter);

    fetch(`/api/card-sets?${params}`)
      .then((res) => res.json())
      .then((data: { sets: CardSetOption[] }) => setSets(data.sets))
      .catch(() => setSets([]));
  }, [tcgFilter]);

  // Reset set filter when TCG changes
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
    const timer = setTimeout(() => search(query, tcgFilter, setFilter, 1), 300);
    return () => clearTimeout(timer);
  }, [query, tcgFilter, setFilter, search]);

  // Immediate search on page change
  useEffect(() => {
    if (page > 1) search(query, tcgFilter, setFilter, page);
  }, [page, query, tcgFilter, setFilter, search]);

  // Load initial results
  useEffect(() => {
    search("", "", "", 1);
  }, [search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
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
                  {s.name} ({s.code}) — {s._count.cards} cards
                </option>
              ))}
            </select>
          </div>
        )}
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
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {results.cards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => onSelect?.(card)}
                  className={`flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white text-left transition-colors ${
                    onSelect
                      ? "cursor-pointer hover:border-indigo-300 hover:shadow-md"
                      : "cursor-default"
                  }`}
                >
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
                    {card._count.variants > 1 && (
                      <span className="absolute bottom-1.5 right-1.5 rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-medium text-white shadow-sm">
                        {card._count.variants} variants
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 p-3">
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
                    {card.number && (
                      <p className="text-xs text-gray-400">#{card.number}</p>
                    )}
                    {card.rarity && (
                      <p className="text-xs text-gray-400">{card.rarity}</p>
                    )}
                  </div>
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
