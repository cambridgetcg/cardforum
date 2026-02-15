"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DigitisationStatusBadge } from "./digitisation-status-badge";
import { CONDITION_LABELS, formatPrice, type Condition, type DigitisationStatus } from "@/types/domain";
import { formatRelativeTime } from "@/lib/utils";
import { X } from "lucide-react";

interface DigitisationRequestCardProps {
  id: string;
  status: DigitisationStatus;
  card: {
    name: string;
    setName: string;
    setCode?: string | null;
    number?: string | null;
  };
  condition: Condition;
  verifiedCondition?: Condition | null;
  authenticator: {
    businessName?: string | null;
    region: string;
  };
  verificationFeeCents: number;
  trackingInbound?: string | null;
  createdAt: string;
  onCancel?: (id: string) => void;
}

export function DigitisationRequestCard({
  id,
  status,
  card,
  condition,
  verifiedCondition,
  authenticator,
  verificationFeeCents,
  trackingInbound,
  createdAt,
  onCancel,
}: DigitisationRequestCardProps) {
  const canCancel = status === "SUBMITTED" || status === "RECEIVED";

  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">{card.name}</h3>
          <DigitisationStatusBadge status={status} />
        </div>
        <p className="text-sm text-gray-600">
          {card.setName}
          {card.setCode && ` (${card.setCode})`}
          {card.number && ` #${card.number}`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="default">
            Declared: {condition} — {CONDITION_LABELS[condition]}
          </Badge>
          {verifiedCondition && (
            <Badge variant="success">
              Verified: {verifiedCondition} — {CONDITION_LABELS[verifiedCondition]}
            </Badge>
          )}
          <Badge variant="default">Fee: {formatPrice(verificationFeeCents)}</Badge>
        </div>
        <p className="text-xs text-gray-500">
          Vault: {authenticator.businessName ?? authenticator.region}
        </p>
        {trackingInbound && (
          <p className="text-xs text-gray-400">Tracking: {trackingInbound}</p>
        )}
        <p className="text-xs text-gray-400">{formatRelativeTime(new Date(createdAt))}</p>
      </div>
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
  );
}
