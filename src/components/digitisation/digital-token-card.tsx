"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DigitalTokenStatusBadge } from "./digital-token-status-badge";
import { CONDITION_LABELS, formatPrice, type Condition, type DigitalTokenStatus } from "@/types/domain";
import { formatRelativeTime } from "@/lib/utils";
import { Tag, ArrowRightLeft, Package } from "lucide-react";

interface DigitalTokenCardProps {
  id: string;
  status: DigitalTokenStatus;
  card: {
    name: string;
    setName: string;
    setCode?: string | null;
    number?: string | null;
    imageUrl?: string | null;
    tcg: string;
  };
  condition: Condition;
  digitiser: { id: string; name?: string | null };
  isOwner: boolean;
  mintedAt: string;
  lastTradedAt?: string | null;
  onList?: (tokenId: string) => void;
  onRedeem?: (tokenId: string) => void;
}

export function DigitalTokenCard({
  id,
  status,
  card,
  condition,
  digitiser,
  isOwner,
  mintedAt,
  lastTradedAt,
  onList,
  onRedeem,
}: DigitalTokenCardProps) {
  const canList = isOwner && status === "ACTIVE";
  const canRedeem = isOwner && status === "ACTIVE";

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* Card image */}
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
            <Package className="h-12 w-12" />
          </div>
        )}
        <div className="absolute right-2 top-2">
          <DigitalTokenStatusBadge status={status} />
        </div>
      </div>

      {/* Token info */}
      <div className="flex flex-col gap-1.5 p-3">
        <h3 className="text-sm font-semibold leading-tight text-gray-900 line-clamp-2">
          {card.name}
        </h3>
        <p className="text-xs text-gray-500">
          {card.setName}
          {card.setCode && ` (${card.setCode})`}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="default">
            {condition} — {CONDITION_LABELS[condition]}
          </Badge>
        </div>
        <p className="text-xs text-gray-400">
          Digitised by {digitiser.name ?? "Unknown"} — {formatRelativeTime(new Date(mintedAt))}
        </p>
        {lastTradedAt && (
          <p className="text-xs text-gray-400">
            Last traded {formatRelativeTime(new Date(lastTradedAt))}
          </p>
        )}

        {/* Actions */}
        {isOwner && (canList || canRedeem) && (
          <div className="mt-2 flex gap-2">
            {canList && onList && (
              <Button size="sm" variant="outline" onClick={() => onList(id)} className="flex-1">
                <Tag className="mr-1 h-3.5 w-3.5" />
                List
              </Button>
            )}
            {canRedeem && onRedeem && (
              <Button size="sm" variant="outline" onClick={() => onRedeem(id)} className="flex-1">
                <ArrowRightLeft className="mr-1 h-3.5 w-3.5" />
                Redeem
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
