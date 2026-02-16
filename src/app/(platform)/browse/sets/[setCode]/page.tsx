"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowLeft, Search, Heart, Dices } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardGridItem } from "@/components/browse/card-grid-item";
import { IntentPanel } from "@/components/listings/intent-panel";
import { SetInsights } from "@/components/expert/set-insights";
import { PullRateTable } from "@/components/collection/pull-rate-table";
import { TCG_LABELS, TCG_BADGE_COLORS, type TCG } from "@/types/domain";
import { useCollectionCheck, useCollectionStats, useAddToCollection, usePullRates } from "@/hooks/use-api";

interface SetInfo {
  id: string;
  tcg: TCG;
  code: string;
  name: string;
  productType: string | null;
  _count: { cards: number };
  coverImage: string | null;
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
  _count: { variants: number };
}

interface CardsResponse {
  cards: CardResult[];
  total: number;
  page: number;
  totalPages: number;
}

type Tab = "cards" | "pull-rates";

export default function SetDetailPage() {
  const { setCode } = useParams<{ setCode: string }>();
  const { data: session } = useSession();
  const [setInfo, setSetInfo] = useState<SetInfo | null>(null);
  const [cards, setCards] = useState<CardsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [intentCard, setIntentCard] = useState<CardResult | null>(null);
  const [intentType, setIntentType] = useState<"have" | "want" | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("cards");

  // Collection: batch check for owned badges on visible cards
  const cardIds = useMemo(() => cards?.cards.map((c) => c.id) ?? [], [cards]);
  const { data: ownedData } = useCollectionCheck(session ? cardIds : []);
  const ownedSet = useMemo(() => new Set(ownedData?.owned ?? []), [ownedData]);
  const addToCollection = useAddToCollection();

  // Collection: stats for accurate set completion (not limited to current page)
  const { data: collectionStats } = useCollectionStats();

  // Pull rates
  const { data: pullRates } = usePullRates(setCode ?? "");

  // Fetch set info
  useEffect(() => {
    if (!setCode) return;
    fetch(`/api/card-sets?tcg=`)
      .then((res) => res.json())
      .then((data: { sets: SetInfo[] }) => {
        const found = data.sets.find((s) => s.code === setCode);
        setSetInfo(found ?? null);
      })
      .catch(() => setSetInfo(null));
  }, [setCode]);

  const fetchCards = useCallback(
    async (q: string, p: number) => {
      if (!setCode) return;
      setLoading(true);
      const params = new URLSearchParams();
      params.set("set", setCode);
      if (q) params.set("query", q);
      params.set("page", String(p));
      params.set("limit", "40");

      try {
        const res = await fetch(`/api/cards?${params}`);
        const data: CardsResponse = await res.json();
        setCards(data);
      } catch {
        setCards(null);
      } finally {
        setLoading(false);
      }
    },
    [setCode]
  );

  // Debounced search
  useEffect(() => {
    setPage(1);
    const timer = setTimeout(() => fetchCards(query, 1), 300);
    return () => clearTimeout(timer);
  }, [query, fetchCards]);

  // Page change
  useEffect(() => {
    if (page > 1) fetchCards(query, page);
  }, [page, query, fetchCards]);

  // Use stats endpoint for accurate full-set completion (not page-limited)
  const setStats = useMemo(
    () => collectionStats?.setCompletion.find((s) => s.setCode === setCode),
    [collectionStats, setCode],
  );
  const ownedCount = setStats?.owned ?? 0;
  const totalCards = setInfo?._count.cards ?? cards?.total ?? 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/browse"
        className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
      >
        <ArrowLeft className="h-4 w-4" /> Browse
      </Link>

      {/* Set header */}
      {setInfo ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{setInfo.name}</h1>
          <div className="flex items-center gap-2">
            <Badge variant={TCG_BADGE_COLORS[setInfo.tcg]} className="text-[10px]">
              {TCG_LABELS[setInfo.tcg]}
            </Badge>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono font-medium text-gray-600">
              {setInfo.code}
            </span>
            {setInfo.productType && (
              <span className="text-sm text-gray-400 capitalize">{setInfo.productType}</span>
            )}
            <span className="text-sm text-gray-400">
              {setInfo._count.cards} cards
            </span>
          </div>
        </div>
      ) : (
        <h1 className="mt-4 text-2xl font-bold text-gray-900">{setCode}</h1>
      )}

      {/* Collection progress bar */}
      {session && totalCards > 0 && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 font-medium text-rose-700">
              <Heart className="h-4 w-4" />
              Your Collection
            </span>
            <span className="text-rose-600">
              {ownedCount} / {totalCards} ({totalCards > 0 ? Math.round((ownedCount / totalCards) * 100) : 0}%)
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-rose-200">
            <div
              className="h-full rounded-full bg-rose-500 transition-all duration-500"
              style={{ width: `${totalCards > 0 ? (ownedCount / totalCards) * 100 : 0}%` }}
            />
          </div>
          {ownedCount === 0 && (
            <p className="mt-1.5 text-xs text-rose-500">
              Hover over cards and click Collect to start building your set!
            </p>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="mt-5 flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("cards")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "cards"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Cards
        </button>
        {pullRates && (
          <button
            onClick={() => setActiveTab("pull-rates")}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "pull-rates"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Dices className="h-3.5 w-3.5" />
            Pull Rates
          </button>
        )}
      </div>

      {/* Tab content */}
      {activeTab === "cards" && (
        <>
          {/* Search within set */}
          <div className="mt-5 relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search within this set..."
              className="pl-10"
            />
          </div>

          <div className="mt-5">
            {loading && <p className="text-sm text-gray-500">Loading cards...</p>}

            {cards && !loading && (
              <>
                <p className="mb-4 text-sm text-gray-500">
                  {cards.total} card{cards.total !== 1 ? "s" : ""}
                  {query && " matching your search"}
                </p>

                {cards.cards.length === 0 ? (
                  <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
                    <p className="text-gray-500">No cards found.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {cards.cards.map((card) => (
                      <CardGridItem
                        key={card.id}
                        id={card.id}
                        tcg={card.tcg}
                        name={card.name}
                        setName={card.setName}
                        setCode={card.setCode}
                        number={card.number}
                        rarity={card.rarity}
                        imageUrl={card.imageUrl}
                        variantCount={card._count.variants}
                        owned={ownedSet.has(card.id)}
                        onHave={() => { setIntentCard(card); setIntentType("have"); }}
                        onWant={() => { setIntentCard(card); setIntentType("want"); }}
                        onCollect={session ? () => {
                          addToCollection.mutate({ cardId: card.id });
                        } : undefined}
                      />
                    ))}
                  </div>
                )}

                {cards.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600">
                      Page {cards.page} of {cards.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= cards.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {activeTab === "pull-rates" && pullRates && (
        <div className="mt-5">
          <PullRateTable
            rates={pullRates.rates}
            packsPerBox={pullRates.packsPerBox}
            setCode={pullRates.setCode}
            language={pullRates.language}
          />
          <div className="mt-6 text-center">
            <Link href={`/packs?set=${setCode}`}>
              <Button>
                <Dices className="mr-2 h-4 w-4" />
                Simulate Pack Opening
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Expert Insights for this set */}
      {setInfo && activeTab === "cards" && (
        <div className="mt-8">
          <SetInsights setId={setInfo.id} />
        </div>
      )}

      {/* Intent Panel from hover overlay */}
      <IntentPanel
        open={intentType !== null}
        card={intentCard ? {
          id: intentCard.id,
          tcg: intentCard.tcg,
          name: intentCard.name,
          setName: intentCard.setName,
          setCode: intentCard.setCode,
          number: intentCard.number,
          imageUrl: intentCard.imageUrl,
        } : null}
        type={intentType ?? "have"}
        onClose={() => { setIntentType(null); setIntentCard(null); }}
        onCreated={() => { setIntentType(null); setIntentCard(null); }}
      />
    </div>
  );
}
