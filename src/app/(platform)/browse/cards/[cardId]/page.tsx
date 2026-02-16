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
  TCG_LABELS,
  TCG_BADGE_COLORS,
  CONDITION_LABELS,
  formatPrice,
  type TCG,
  type Condition,
} from "@/types/domain";

interface Variant {
  id: string;
  language: string;
  edition: string;
  treatment: string | null;
  rarity: string | null;
  version: string;
  imageUrl: string | null;
}

interface HaveListing {
  id: string;
  askPrice: number;
  currency: string;
  condition: Condition;
  language: string;
  quantity: number;
  createdAt: string;
  user: { id: string; name: string | null };
}

interface WantListing {
  id: string;
  bidPrice: number;
  currency: string;
  minCondition: Condition;
  language: string | null;
  maxQuantity: number;
  createdAt: string;
  user: { id: string; name: string | null };
}

interface CardDetail {
  id: string;
  tcg: TCG;
  name: string;
  setName: string;
  setCode: string | null;
  number: string | null;
  rarity: string | null;
  imageUrl: string | null;
  set: { id: string; code: string; name: string; productType: string | null } | null;
  variants: Variant[];
  haveListings: HaveListing[];
  wantListings: WantListing[];
  _count: { variants: number; haveListings: number; wantListings: number };
}

export default function CardDetailPage() {
  const { cardId } = useParams<{ cardId: string }>();
  const [card, setCard] = useState<CardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [intentType, setIntentType] = useState<"have" | "want" | null>(null);

  useEffect(() => {
    if (!cardId) return;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
    fetch(`/api/cards/${cardId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Card not found");
        return res.json();
      })
      .then((data: { card: CardDetail }) => {
        setCard(data.card);
        setActiveImage(data.card.imageUrl);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [cardId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-sm text-gray-500">Loading card...</p>
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Link
          href="/browse"
          className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
        >
          <ArrowLeft className="h-4 w-4" /> Browse
        </Link>
        <p className="mt-4 text-gray-500">{error ?? "Card not found."}</p>
      </div>
    );
  }

  // Collect all unique images for thumbnail strip
  const allImages = [card.imageUrl, ...card.variants.map((v) => v.imageUrl)].filter(
    (url): url is string => url != null,
  );
  const uniqueImages = [...new Set(allImages)];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      {card.set ? (
        <Link
          href={`/browse/sets/${card.set.code}`}
          className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
        >
          <ArrowLeft className="h-4 w-4" /> {card.set.name}
        </Link>
      ) : (
        <Link
          href="/browse"
          className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
        >
          <ArrowLeft className="h-4 w-4" /> Browse
        </Link>
      )}

      {/* Top section: image + info */}
      <div className="mt-4 flex flex-col gap-6 md:flex-row">
        {/* Left: image */}
        <div className="shrink-0 md:w-72">
          <div className="aspect-[5/7] w-full overflow-hidden rounded-xl bg-gray-100">
            {activeImage ? (
              <img src={activeImage} alt={card.name} className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-gray-300">
                <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          {/* Variant thumbnails */}
          {uniqueImages.length > 1 && (
            <div className="mt-2 flex gap-1.5 overflow-x-auto">
              {uniqueImages.map((url) => (
                <button
                  key={url}
                  onClick={() => setActiveImage(url)}
                  className={`h-14 w-10 shrink-0 overflow-hidden rounded-md border-2 bg-gray-100 ${
                    activeImage === url ? "border-indigo-500" : "border-transparent"
                  }`}
                >
                  <img src={url} alt="" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: info */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{card.name}</h1>
            <Badge variant={TCG_BADGE_COLORS[card.tcg]} className="text-xs">
              {TCG_LABELS[card.tcg]}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
            {card.set && (
              <Link
                href={`/browse/sets/${card.set.code}`}
                className="text-indigo-600 hover:text-indigo-800"
              >
                {card.set.name} ({card.set.code})
              </Link>
            )}
            {!card.set && card.setName && (
              <span>
                {card.setName}
                {card.setCode && ` (${card.setCode})`}
              </span>
            )}
            {card.number && <span>#{card.number}</span>}
            {card.rarity && <span>{card.rarity}</span>}
          </div>

          <p className="text-sm text-gray-400">
            {card._count.variants} variant{card._count.variants !== 1 ? "s" : ""}
          </p>

          {/* Variant list */}
          {card.variants.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {card.variants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => v.imageUrl && setActiveImage(v.imageUrl)}
                  className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-600 hover:border-indigo-300 hover:bg-indigo-50"
                >
                  {v.language}
                  {v.treatment && ` · ${v.treatment}`}
                  {v.rarity && ` · ${v.rarity}`}
                  {v.version && ` · ${v.version}`}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 flex gap-3">
            <Button variant="primary" size="sm" onClick={() => setIntentType("have")}>
              Sell This
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIntentType("want")}>
              Buy This
            </Button>
            <Link href={`/marketplace/${card.id}`}>
              <Button variant="ghost" size="sm">
                View Order Book
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom section: active listings */}
      <div className="mt-8 space-y-6">
        {/* Have Listings (Asks) */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <h2 className="border-b border-gray-100 px-5 py-3 text-sm font-semibold text-gray-900">
            Active Have Listings ({card.haveListings.length})
          </h2>
          {card.haveListings.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              No active have listings for this card.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500">
                    <th className="px-5 py-2 text-left font-medium">Price</th>
                    <th className="px-5 py-2 text-left font-medium">Condition</th>
                    <th className="px-5 py-2 text-left font-medium">Qty</th>
                    <th className="px-5 py-2 text-left font-medium">Language</th>
                    <th className="px-5 py-2 text-left font-medium">Seller</th>
                    <th className="px-5 py-2 text-left font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {card.haveListings.map((l) => (
                    <tr key={l.id} className="border-b border-gray-50">
                      <td className="px-5 py-2 font-semibold text-amber-600 tabular-nums">
                        {formatPrice(l.askPrice, l.currency)}
                      </td>
                      <td className="px-5 py-2 text-gray-700">{CONDITION_LABELS[l.condition]}</td>
                      <td className="px-5 py-2 text-gray-700 tabular-nums">{l.quantity}</td>
                      <td className="px-5 py-2 text-gray-500">{l.language}</td>
                      <td className="px-5 py-2 text-gray-700">{l.user.name ?? "Anonymous"}</td>
                      <td className="px-5 py-2 text-gray-400">
                        {new Date(l.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Want Listings (Bids) */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <h2 className="border-b border-gray-100 px-5 py-3 text-sm font-semibold text-gray-900">
            Active Want Listings ({card.wantListings.length})
          </h2>
          {card.wantListings.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              No active want listings for this card.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500">
                    <th className="px-5 py-2 text-left font-medium">Price</th>
                    <th className="px-5 py-2 text-left font-medium">Min Condition</th>
                    <th className="px-5 py-2 text-left font-medium">Max Qty</th>
                    <th className="px-5 py-2 text-left font-medium">Language</th>
                    <th className="px-5 py-2 text-left font-medium">Buyer</th>
                    <th className="px-5 py-2 text-left font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {card.wantListings.map((l) => (
                    <tr key={l.id} className="border-b border-gray-50">
                      <td className="px-5 py-2 font-semibold text-emerald-600 tabular-nums">
                        {formatPrice(l.bidPrice, l.currency)}
                      </td>
                      <td className="px-5 py-2 text-gray-700">
                        {CONDITION_LABELS[l.minCondition]}
                      </td>
                      <td className="px-5 py-2 text-gray-700 tabular-nums">{l.maxQuantity}</td>
                      <td className="px-5 py-2 text-gray-500">{l.language ?? "Any"}</td>
                      <td className="px-5 py-2 text-gray-700">{l.user.name ?? "Anonymous"}</td>
                      <td className="px-5 py-2 text-gray-400">
                        {new Date(l.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Expert Insights */}
      <div className="mt-6">
        <CardInsights cardId={card.id} />
      </div>

      {/* Intent Panel */}
      {card && (
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
            // Refetch to update listing counts
            fetch(`/api/cards/${cardId}`)
              .then((res) => res.json())
              .then((data: { card: CardDetail }) => setCard(data.card))
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
}
