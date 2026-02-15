"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RedemptionStatusBadge } from "./redemption-status-badge";
import { CONDITION_LABELS, formatPrice, type Condition, type RedemptionStatus } from "@/types/domain";
import { formatRelativeTime } from "@/lib/utils";
import { CheckCircle, X } from "lucide-react";

interface RedemptionCardProps {
  id: string;
  status: RedemptionStatus;
  token: {
    card: {
      name: string;
      setName: string;
      setCode?: string | null;
      number?: string | null;
    };
    condition: Condition;
  };
  vaultAuthenticator: {
    businessName?: string | null;
    region: string;
  };
  vaultCountry: string;
  redeemerCountry: string;
  isCrossZone: boolean;
  redemptionFeeCents: number;
  crossZoneSurcharge: number;
  trackingOutbound?: string | null;
  createdAt: string;
  onConfirm?: (id: string) => void;
  onCancel?: (id: string) => void;
}

export function RedemptionCard({
  id,
  status,
  token,
  vaultAuthenticator,
  isCrossZone,
  redemptionFeeCents,
  crossZoneSurcharge,
  trackingOutbound,
  createdAt,
  onConfirm,
  onCancel,
}: RedemptionCardProps) {
  const canConfirm = status === "DELIVERED";
  const canCancel = status === "REQUESTED" || status === "STOCK_RESERVED" || status === "PREPARING";
  const totalFee = redemptionFeeCents + crossZoneSurcharge;

  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">{token.card.name}</h3>
          <RedemptionStatusBadge status={status} />
          {isCrossZone && <Badge variant="warning">Cross-Zone</Badge>}
        </div>
        <p className="text-sm text-gray-600">
          {token.card.setName}
          {token.card.setCode && ` (${token.card.setCode})`}
          {token.card.number && ` #${token.card.number}`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="default">
            {token.condition} — {CONDITION_LABELS[token.condition]}
          </Badge>
          <Badge variant="default">Fee: {formatPrice(totalFee)}</Badge>
        </div>
        <p className="text-xs text-gray-500">
          Vault: {vaultAuthenticator.businessName ?? vaultAuthenticator.region}
        </p>
        {trackingOutbound && (
          <p className="text-xs text-gray-400">Tracking: {trackingOutbound}</p>
        )}
        <p className="text-xs text-gray-400">{formatRelativeTime(new Date(createdAt))}</p>
      </div>
      <div className="flex gap-1">
        {canConfirm && onConfirm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onConfirm(id)}
            className="text-green-600 hover:text-green-700"
          >
            <CheckCircle className="h-4 w-4" />
          </Button>
        )}
        {canCancel && onCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCancel(id)}
            className="text-gray-400 hover:text-red-500"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
