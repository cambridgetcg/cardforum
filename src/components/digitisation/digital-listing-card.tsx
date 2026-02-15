"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CONDITION_LABELS, formatPrice, type Condition } from "@/types/domain";
import { Package, ShoppingCart } from "lucide-react";

interface DigitalListingCardProps {
  id: string;
  askPrice: number;
  seller: { id: string; name?: string | null };
  token: {
    id: string;
    condition: Condition;
    digitiser: { id: string; name?: string | null };
    card: {
      name: string;
      setName: string;
      setCode?: string | null;
      number?: string | null;
      imageUrl?: string | null;
      tcg: string;
    };
  };
  currentUserId?: string;
  onBuy?: (listingId: string) => void;
}

const TCG_BADGE_COLORS: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  POKEMON: "warning",
  ONEPIECE: "error",
  YUGIOH: "info",
  MTG: "success",
};

const TCG_LABELS: Record<string, string> = {
  POKEMON: "Pokemon",
  ONEPIECE: "One Piece",
  YUGIOH: "Yu-Gi-Oh!",
  MTG: "Magic",
};

export function DigitalListingCard({
  id,
  askPrice,
  seller,
  token,
  currentUserId,
  onBuy,
}: DigitalListingCardProps) {
  const isSeller = currentUserId === seller.id;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* Card image */}
      <div className="relative aspect-[5/7] w-full bg-gray-100">
        {token.card.imageUrl ? (
          <img
            src={token.card.imageUrl}
            alt={token.card.name}
            className="h-full w-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300">
            <Package className="h-12 w-12" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1.5 p-3">
        <div className="flex items-start justify-between gap-1">
          <h3 className="text-sm font-semibold leading-tight text-gray-900 line-clamp-2">
            {token.card.name}
          </h3>
          <Badge
            variant={TCG_BADGE_COLORS[token.card.tcg] ?? "default"}
            className="shrink-0 text-[10px]"
          >
            {TCG_LABELS[token.card.tcg] ?? token.card.tcg}
          </Badge>
        </div>
        <p className="text-xs text-gray-500">
          {token.card.setName}
          {token.card.setCode && ` (${token.card.setCode})`}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="default">
            {token.condition} — {CONDITION_LABELS[token.condition]}
          </Badge>
        </div>

        {/* Price + buy */}
        <div className="mt-1 rounded-lg bg-gray-50 px-2.5 py-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-indigo-600">
              {formatPrice(askPrice)}
            </span>
            <span className="text-xs text-gray-400">
              by {seller.name ?? "Anonymous"}
            </span>
          </div>
        </div>

        {!isSeller && onBuy && (
          <Button size="sm" onClick={() => onBuy(id)} className="mt-1 w-full">
            <ShoppingCart className="mr-1 h-3.5 w-3.5" />
            Buy Now
          </Button>
        )}
        {isSeller && (
          <p className="mt-1 text-center text-xs text-gray-400">Your listing</p>
        )}
      </div>
    </div>
  );
}
