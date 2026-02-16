"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CONDITION_LABELS, TCG_LABELS, formatPrice, type TCG, type Condition } from "@/types/domain";
import { formatRelativeTime } from "@/lib/utils";
import { ConditionBadge } from "./condition-badge";
import { Trash2, Pause, Play, Check, X, Pencil } from "lucide-react";

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
  currency?: string;
  notes: string | null;
  isActive?: boolean;
  createdAt: string;
  onDelete: (id: string, type: "have" | "want") => void;
  onUpdate?: (id: string, type: "have" | "want", data: Record<string, unknown>) => Promise<void>;
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
  currency = "USD",
  notes,
  isActive = true,
  createdAt,
  onDelete,
  onUpdate,
  aiCCSComposite,
  sellerOverrodeAI,
  isAuthVerified,
}: ListingCardProps) {
  const [editing, setEditing] = useState(false);
  const [editPrice, setEditPrice] = useState("");
  const [saving, setSaving] = useState(false);

  function startEdit() {
    // Convert from minor units to display value
    const display = (price / 100).toFixed(2);
    setEditPrice(display);
    setEditing(true);
  }

  async function savePrice() {
    if (!onUpdate) return;
    const numericPrice = parseFloat(editPrice);
    if (isNaN(numericPrice) || numericPrice <= 0) return;
    const priceInCents = Math.round(numericPrice * 100);
    setSaving(true);
    try {
      const priceField = type === "have" ? "askPrice" : "bidPrice";
      await onUpdate(id, type, { [priceField]: priceInCents });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!onUpdate) return;
    setSaving(true);
    try {
      await onUpdate(id, type, { isActive: !isActive });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`flex items-start justify-between gap-3 rounded-xl border bg-white p-4 ${
      isActive ? "border-gray-200" : "border-gray-100 opacity-60"
    }`}>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">{card.name}</h3>
          <Badge variant={type === "have" ? "success" : "info"}>
            {type === "have" ? "Have" : "Want"}
          </Badge>
          {!isActive && <Badge variant="default">Paused</Badge>}
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

          {/* Inline price editing */}
          {editing ? (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={0.01}
                step={0.01}
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                className="h-6 w-24 text-xs"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") savePrice();
                  if (e.key === "Escape") setEditing(false);
                }}
              />
              <button
                onClick={savePrice}
                disabled={saving}
                className="rounded p-0.5 text-emerald-600 hover:bg-emerald-50"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded p-0.5 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onUpdate ? startEdit : undefined}
              className={`flex items-center gap-1 ${onUpdate ? "cursor-pointer hover:opacity-80" : ""}`}
            >
              <Badge variant="default">
                {type === "have" ? "Ask" : "Bid"}: {formatPrice(price, currency)}
              </Badge>
              {onUpdate && <Pencil className="h-3 w-3 text-gray-400" />}
            </button>
          )}
        </div>
        {notes && <p className="text-xs text-gray-400">{notes}</p>}
        <p className="text-xs text-gray-400">{formatRelativeTime(new Date(createdAt))}</p>
      </div>
      <div className="flex flex-col gap-1">
        {onUpdate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleActive}
            disabled={saving}
            className="text-gray-400 hover:text-gray-600"
            title={isActive ? "Pause listing" : "Resume listing"}
          >
            {isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(id, type)}
          className="text-gray-400 hover:text-red-500"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
