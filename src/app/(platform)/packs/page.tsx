"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Dices, RotateCcw, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePullRates } from "@/hooks/use-api";

interface SimulatedCard {
  rarity: string;
  slotIndex: number;
  isRare: boolean;
  revealed: boolean;
}

const RARITY_LABELS: Record<string, string> = {
  C: "Common",
  UC: "Uncommon",
  R: "Rare",
  SR: "Super Rare",
  SEC: "Secret Rare",
  L: "Leader",
  SP: "Special",
};

const RARITY_BG: Record<string, string> = {
  C: "bg-gray-100 text-gray-700 border-gray-200",
  UC: "bg-green-100 text-green-700 border-green-200",
  R: "bg-blue-100 text-blue-700 border-blue-200",
  SR: "bg-purple-100 text-purple-700 border-purple-200 ring-2 ring-purple-300",
  SEC: "bg-amber-100 text-amber-700 border-amber-200 ring-2 ring-amber-300",
  L: "bg-rose-100 text-rose-700 border-rose-200 ring-2 ring-rose-300",
  SP: "bg-pink-100 text-pink-700 border-pink-200",
};

// Available sets for simulation
const SETS = [
  "OP01",
  "OP02",
  "OP03",
  "OP04",
  "OP05",
  "OP06",
  "OP07",
  "OP08",
  "OP09",
  "OP10",
  "OP11",
  "OP12",
  "OP13",
  "OP14",
];

/**
 * Simulate one pack using pull rate data.
 * Uses weighted random to fill card slots based on per-pack rates.
 */
function simulatePack(rates: { rarity: string; perPack: number }[]): SimulatedCard[] {
  const cards: SimulatedCard[] = [];
  let slotIndex = 0;

  for (const rate of rates) {
    const base = Math.floor(rate.perPack);
    const fractional = rate.perPack - base;
    const count = base + (Math.random() < fractional ? 1 : 0);

    for (let i = 0; i < count; i++) {
      cards.push({
        rarity: rate.rarity,
        slotIndex: slotIndex++,
        isRare: ["SR", "SEC", "L", "SP"].includes(rate.rarity),
        revealed: false,
      });
    }
  }

  // Shuffle commons, keep rares near the end for drama
  const commons = cards.filter((c) => !c.isRare);
  const rares = cards.filter((c) => c.isRare);

  for (let i = commons.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [commons[i], commons[j]] = [commons[j], commons[i]];
  }

  return [...commons, ...rares].map((c, i) => ({ ...c, slotIndex: i }));
}

function PackSimulator() {
  const searchParams = useSearchParams();
  const initialSet = searchParams.get("set")?.toUpperCase() ?? "OP01";
  const [selectedSet, setSelectedSet] = useState(initialSet);
  const [pack, setPack] = useState<SimulatedCard[] | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [allRevealed, setAllRevealed] = useState(false);

  const { data: pullRates, isLoading, isError } = usePullRates(selectedSet);

  const openPack = useCallback(() => {
    if (!pullRates) return;
    const simulated = simulatePack(pullRates.rates);
    setPack(simulated);
    setRevealedCount(0);
    setAllRevealed(false);
  }, [pullRates]);

  const revealNext = useCallback(() => {
    if (!pack) return;
    const nextIndex = revealedCount;
    if (nextIndex >= pack.length) {
      setAllRevealed(true);
      return;
    }
    setPack(
      (prev) => prev?.map((c, i) => (i === nextIndex ? { ...c, revealed: true } : c)) ?? null,
    );
    setRevealedCount((prev) => prev + 1);
  }, [pack, revealedCount]);

  const revealAll = useCallback(() => {
    setPack((prev) => prev?.map((c) => ({ ...c, revealed: true })) ?? null);
    setRevealedCount(pack?.length ?? 0);
    setAllRevealed(true);
  }, [pack]);

  // Keyboard support — only active when no focused interactive element
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON" || tag === "A") return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!pack) openPack();
        else if (!allRevealed) revealNext();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [pack, allRevealed, openPack, revealNext]);

  const rareCount = pack?.filter((c) => c.isRare && c.revealed).length ?? 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="text-center">
        <Dices className="mx-auto h-8 w-8 text-indigo-600" />
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Pack Simulator</h1>
        <p className="mt-1 text-sm text-gray-600">
          Experience the thrill of opening packs — see what you might pull!
        </p>
      </div>

      {/* Set selector */}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {SETS.map((code) => (
          <Button
            key={code}
            variant={selectedSet === code ? "primary" : "outline"}
            size="sm"
            onClick={() => {
              setSelectedSet(code);
              setPack(null);
            }}
          >
            {code}
          </Button>
        ))}
      </div>

      {/* Open pack button / status */}
      <div className="mt-8 text-center">
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading pull rate data...</p>
        ) : isError ? (
          <div className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            Failed to load pull rate data. Please try again.
          </div>
        ) : !pullRates ? (
          <p className="text-sm text-gray-500">No pull rate data available for {selectedSet}.</p>
        ) : !pack ? (
          <Button size="lg" onClick={openPack}>
            <Sparkles className="mr-2 h-5 w-5" />
            Open a {selectedSet} Pack
          </Button>
        ) : null}
      </div>

      {/* Pack contents */}
      {pack && (
        <div className="mt-8">
          {/* Card grid */}
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
            {pack.map((card, i) => (
              <button
                key={i}
                onClick={() => {
                  if (!card.revealed) {
                    setPack(
                      (prev) =>
                        prev?.map((c, j) => (j === i ? { ...c, revealed: true } : c)) ?? null,
                    );
                    setRevealedCount((prev) => prev + 1);
                    if (revealedCount + 1 >= pack.length) setAllRevealed(true);
                  }
                }}
                className={`aspect-[5/7] rounded-lg border-2 transition-all duration-300 ${
                  card.revealed
                    ? `${RARITY_BG[card.rarity] ?? "border-gray-200 bg-gray-100 text-gray-700"} ${
                        card.isRare ? "scale-105 shadow-lg" : ""
                      }`
                    : "cursor-pointer border-indigo-300 bg-gradient-to-br from-indigo-500 to-purple-600 hover:scale-105 hover:shadow-md"
                }`}
              >
                {card.revealed ? (
                  <div className="flex h-full flex-col items-center justify-center gap-1 p-1">
                    {card.isRare && <Sparkles className="h-5 w-5 animate-pulse" />}
                    <span className="text-sm font-bold">{card.rarity}</span>
                    <span className="text-[10px] leading-tight">
                      {RARITY_LABELS[card.rarity] ?? card.rarity}
                    </span>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <span className="text-2xl font-bold text-white/60">?</span>
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-center gap-3">
            {!allRevealed && (
              <>
                <Button variant="outline" size="sm" onClick={revealNext}>
                  Reveal Next
                </Button>
                <Button variant="outline" size="sm" onClick={revealAll}>
                  Reveal All
                </Button>
              </>
            )}
            {allRevealed && (
              <Button onClick={openPack}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Open Another Pack
              </Button>
            )}
          </div>

          {/* Summary after reveal */}
          {allRevealed && (
            <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4 text-center">
              <p className="text-sm text-gray-600">
                You pulled <span className="font-bold">{pack.length}</span> cards
                {rareCount > 0 && (
                  <>
                    {" "}
                    including{" "}
                    <span className="font-bold text-purple-600">
                      {rareCount} rare{rareCount !== 1 ? "s" : ""}
                    </span>
                  </>
                )}
                !
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {pack.map((card, i) => (
                  <span
                    key={i}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      RARITY_BG[card.rarity]?.replace(/ring-\S+ /g, "") ??
                      "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {card.rarity}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs text-gray-400">
                Press Space or Enter to open another pack
              </p>
            </div>
          )}
        </div>
      )}

      {/* Pull rate reference link */}
      <div className="mt-8 text-center">
        <Link
          href={`/browse/sets/${selectedSet}`}
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          View full pull rates and cards for {selectedSet}
        </Link>
      </div>

      {/* Disclaimer */}
      <p className="mt-6 text-center text-xs text-gray-400">
        Simulated packs for entertainment and educational purposes only. Results use theoretical
        pull rates and do not represent actual product contents. Not affiliated with Bandai, The
        Pokemon Company, Konami, or Wizards of the Coast.
      </p>
    </div>
  );
}

export default function PacksPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-8 text-center">
          <Dices className="mx-auto h-8 w-8 text-indigo-600" />
          <p className="mt-4 text-sm text-gray-500">Loading pack simulator...</p>
        </div>
      }
    >
      <PackSimulator />
    </Suspense>
  );
}
