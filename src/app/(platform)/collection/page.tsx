"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, Trash2, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCollection, useCollectionStats, useRemoveFromCollection } from "@/hooks/use-api";
import { TCG_FILTERS, TCG_LABELS, TCG_BADGE_COLORS, type TCG } from "@/types/domain";
import { formatPrice } from "@/lib/currency";

export default function CollectionPage() {
  const [tcgFilter, setTcgFilter] = useState<string>("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const { data: collectionData, isLoading: loadingEntries, isError: entriesError } = useCollection(
    tcgFilter ? { tcg: tcgFilter } : undefined,
  );
  const { data: stats, isLoading: loadingStats, isError: statsError } = useCollectionStats();
  const removeEntry = useRemoveFromCollection();

  const entries = collectionData?.entries ?? [];

  function handleRemove(entryId: string) {
    setRemovingId(entryId);
    removeEntry.mutate(entryId, {
      onSettled: () => setRemovingId(null),
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <Heart className="h-6 w-6 text-rose-500" />
        <h1 className="text-2xl font-bold text-gray-900">My Collection</h1>
      </div>
      <p className="mt-1 text-sm text-gray-600">
        Track every card you own. See your progress toward completing sets.
      </p>

      {/* Error banner */}
      {(entriesError || statsError) && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load collection data. Please try refreshing the page.
        </div>
      )}

      {/* Stats summary */}
      {loadingStats && (
        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="py-4 text-center">
                <div className="mx-auto h-8 w-12 animate-pulse rounded bg-gray-200" />
                <div className="mx-auto mt-2 h-4 w-20 animate-pulse rounded bg-gray-100" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {stats && !loadingStats && (
        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-3xl font-bold text-gray-900">{stats.totalCards}</p>
              <p className="text-sm text-gray-500">Total Cards</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-3xl font-bold text-gray-900">{stats.uniqueCards}</p>
              <p className="text-sm text-gray-500">Unique Cards</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-3xl font-bold text-gray-900">{stats.setCompletion.length}</p>
              <p className="text-sm text-gray-500">Sets Started</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-3xl font-bold text-gray-900">
                {stats.totalValue > 0 ? formatPrice(stats.totalValue) : "$0"}
              </p>
              <p className="text-sm text-gray-500">Tracked Value</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Set completion progress */}
      {stats && stats.setCompletion.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">Set Completion</h2>
          <div className="mt-3 space-y-3">
            {stats.setCompletion.map((sc) => (
              <Link
                key={sc.setCode}
                href={`/browse/sets/${sc.setCode}`}
                className="block rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-indigo-300"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono font-medium text-gray-600">
                      {sc.setCode}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{sc.setName}</span>
                    <Badge
                      variant={TCG_BADGE_COLORS[sc.tcg as TCG] ?? "default"}
                      className="text-[10px]"
                    >
                      {TCG_LABELS[sc.tcg as TCG] ?? sc.tcg}
                    </Badge>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">
                    {sc.owned}/{sc.total} ({sc.pct}%)
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-rose-500 transition-all duration-500"
                    style={{ width: `${sc.pct}%` }}
                  />
                </div>
                {sc.pct === 100 && (
                  <p className="mt-1 text-xs font-medium text-emerald-600">
                    Set Complete!
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Collection cards */}
      <div className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900">
            Cards
            {entries.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">({entries.length})</span>
            )}
          </h2>
          <div className="flex flex-wrap gap-2">
            {TCG_FILTERS.map((f) => (
              <Button
                key={f.value}
                variant={tcgFilter === f.value ? "primary" : "outline"}
                size="sm"
                onClick={() => setTcgFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        {loadingEntries && (
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading collection...
          </div>
        )}

        {!loadingEntries && entries.length === 0 && !entriesError && (
          <div className="mt-4 rounded-xl border border-gray-200 bg-white py-12 text-center">
            <Heart className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-3 text-gray-500">
              {tcgFilter
                ? "No cards from this TCG in your collection yet."
                : "Your collection is empty. Browse sets to start collecting!"}
            </p>
            <Link href="/browse" className="mt-3 inline-block">
              <Button>Browse Cards</Button>
            </Link>
          </div>
        )}

        {!loadingEntries && entries.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex gap-3 rounded-lg border border-gray-200 bg-white p-3"
              >
                <Link href={`/browse/cards/${entry.card.id}`} className="shrink-0">
                  {entry.card.imageUrl ? (
                    <img
                      src={entry.card.imageUrl}
                      alt={entry.card.name}
                      className="h-20 w-14 rounded object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-20 w-14 items-center justify-center rounded bg-gray-100 text-gray-300">
                      <Heart className="h-5 w-5" />
                    </div>
                  )}
                </Link>
                <div className="flex flex-1 flex-col justify-between min-w-0">
                  <div>
                    <Link
                      href={`/browse/cards/${entry.card.id}`}
                      className="text-sm font-semibold text-gray-900 hover:text-indigo-600 line-clamp-1"
                    >
                      {entry.card.name}
                    </Link>
                    <p className="text-xs text-gray-500">
                      {entry.card.setName}
                      {entry.card.setCode && ` (${entry.card.setCode})`}
                      {entry.card.number && ` #${entry.card.number}`}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      {entry.card.rarity && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                          {entry.card.rarity}
                        </span>
                      )}
                      {entry.condition && (
                        <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">
                          {entry.condition}
                        </span>
                      )}
                      {entry.quantity > 1 && (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                          x{entry.quantity}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 flex items-center justify-end">
                    <button
                      onClick={() => handleRemove(entry.id)}
                      disabled={removingId === entry.id}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                      title="Remove from collection"
                    >
                      {removingId === entry.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
