"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CONDITION_LABELS, TCG_LABELS, formatPrice, type TCG, type Condition } from "@/types/domain";
import { formatRelativeTime } from "@/lib/utils";
import { ConditionBadge } from "./condition-badge";
import { Trash2 } from "lucide-react";

interface ListingCardProps {
  id: string;
  type: "have" | "want";
  card: {
    name: string;
    setName: string;
    setCode: string | null;
    number: string | null;
    tcg: TCG;
    rarity: string | null;
  };
  condition: Condition;
  quantity: number;
  price: number; // cents — askPrice for have, bidPrice for want
  notes: string | null;
  createdAt: string;
  onDelete: (id: string, type: "have" | "want") => void;
  // AI condition trust data (optional — only for have listings with AI grading)
  aiCCSComposite?: number | null;
  sellerOverrodeAI?: boolean;
  isAuthVerified?: boolean;
}

export function ListingCard({
  id,
  type,
  card,
  condition,
  quantity,
  price,
  notes,
  createdAt,
  onDelete,
  aiCCSComposite,
  sellerOverrodeAI,
  isAuthVerified,
}: ListingCardProps) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">{card.name}</h3>
          <Badge variant={type === "have" ? "success" : "info"}>
            {type === "have" ? "Have" : "Want"}
          </Badge>
          {type === "have" && (
            <ConditionBadge
              listing={{
                aiCCSComposite: aiCCSComposite ?? null,
                sellerOverrodeAI: sellerOverrodeAI ?? false,
              }}
              isAuthVerified={isAuthVerified}
            />
          )}
        </div>
        <p className="text-sm text-gray-600">
          {card.setName}
          {card.setCode && ` (${card.setCode})`}
          {card.number && ` #${card.number}`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge>{TCG_LABELS[card.tcg]}</Badge>
          <Badge variant="default">
            {type === "have" ? condition : `Min: ${condition}`} — {CONDITION_LABELS[condition]}
          </Badge>
          {quantity > 1 && <Badge variant="default">x{quantity}</Badge>}
          <Badge variant="default">
            {type === "have" ? "Ask" : "Bid"}: {formatPrice(price)}
          </Badge>
        </div>
        {notes && <p className="text-xs text-gray-400">{notes}</p>}
        <p className="text-xs text-gray-400">{formatRelativeTime(new Date(createdAt))}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDelete(id, type)}
        className="text-gray-400 hover:text-red-500"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
