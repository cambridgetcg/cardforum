"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SetCard } from "@/components/browse/set-card";
import { TCG_FILTERS, TCG_LABELS, type TCG } from "@/types/domain";

interface CardSetResult {
  id: string;
  tcg: TCG;
  code: string;
  name: string;
  productType: string | null;
  coverImage: string | null;
  _count: { cards: number };
}

export default function BrowsePage() {
  const [tcgFilter, setTcgFilter] = useState<TCG | "">("");
  const [sets, setSets] = useState<CardSetResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
    const params = new URLSearchParams();
    if (tcgFilter) params.set("tcg", tcgFilter);

    fetch(`/api/card-sets?${params}`)
      .then((res) => res.json())
      .then((data: { sets: CardSetResult[] }) => setSets(data.sets))
      .catch(() => setSets([]))
      .finally(() => setLoading(false));
  }, [tcgFilter]);

  // Group sets by TCG, with ONEPIECE first when unfiltered
  const tcgOrder: TCG[] = tcgFilter ? [tcgFilter] : ["ONEPIECE", "POKEMON", "YUGIOH", "MTG"];

  const grouped = tcgOrder
    .map((tcg) => ({
      tcg,
      sets: sets.filter((s) => s.tcg === tcg),
    }))
    .filter((g) => g.sets.length > 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">Browse Cards</h1>
      <p className="mt-1 text-sm text-gray-600">Explore sets and cards across all supported TCGs</p>

      <div className="mt-6 space-y-6">
        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
          <div className="relative sm:ml-auto sm:w-64">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Quick search cards..."
              className="pl-10"
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchQuery.trim()) {
                  window.location.href = `/browse/search?q=${encodeURIComponent(searchQuery.trim())}`;
                }
              }}
            />
          </div>
        </div>

        {loading && <p className="text-sm text-gray-500">Loading sets...</p>}

        {!loading && sets.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
            <p className="text-gray-500">No sets found.</p>
          </div>
        )}

        {!loading &&
          grouped.map(({ tcg, sets: tcgSets }) => (
            <section key={tcg}>
              {!tcgFilter && (
                <h2 className="mb-3 text-lg font-semibold text-gray-800">{TCG_LABELS[tcg]}</h2>
              )}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {tcgSets.map((set) => (
                  <Link key={set.id} href={`/browse/sets/${set.code}`}>
                    <SetCard
                      code={set.code}
                      name={set.name}
                      tcg={set.tcg}
                      productType={set.productType}
                      cardCount={set._count.cards}
                      coverImage={set.coverImage}
                    />
                  </Link>
                ))}
              </div>
            </section>
          ))}
      </div>
    </div>
  );
}
