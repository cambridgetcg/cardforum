"use client";

import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TradeStatusBadge } from "./trade-status-badge";
import { formatRelativeTime } from "@/lib/utils";
import type { TradeStatus } from "@/types/domain";
import { TRADE_TRANSITIONS } from "@/types/domain";

interface TradeCardProps {
  id: string;
  status: TradeStatus;
  createdAt: string;
  updatedAt: string;
  userAId: string;
  userBId: string;
  currentUserId: string;
  legs: {
    id: string;
    fromUserId: string;
    toUserId: string;
    region: string;
    status: string;
    sequence: number;
  }[];
  onAction: (tradeId: string, action: "accept" | "reject" | "cancel") => void;
}

export function TradeCard({
  id,
  status,
  createdAt,
  updatedAt,
  currentUserId,
  legs,
  onAction,
}: TradeCardProps) {
  const canAccept = status === "PROPOSED" && TRADE_TRANSITIONS[status].includes("ACCEPTED");
  const canReject = status === "PROPOSED" && TRADE_TRANSITIONS[status].includes("REJECTED");
  const canCancel =
    TRADE_TRANSITIONS[status].includes("CANCELLED") &&
    status !== "COMPLETED" &&
    status !== "REJECTED" &&
    status !== "CANCELLED";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">Trade #{id.slice(-6)}</h3>
              <TradeStatusBadge status={status} />
            </div>
            <p className="text-xs text-gray-500">
              Created {formatRelativeTime(new Date(createdAt))} &middot; Updated{" "}
              {formatRelativeTime(new Date(updatedAt))}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">
            {legs.length} leg{legs.length !== 1 ? "s" : ""}
          </p>
          {legs.map((leg) => (
            <div
              key={leg.id}
              className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm"
            >
              <span className="font-mono text-xs text-gray-400">#{leg.sequence + 1}</span>
              <span className={leg.fromUserId === currentUserId ? "font-semibold text-indigo-600" : "text-gray-600"}>
                {leg.fromUserId === currentUserId ? "You" : leg.fromUserId.slice(-6)}
              </span>
              <span className="text-gray-400">&rarr;</span>
              <span className={leg.toUserId === currentUserId ? "font-semibold text-indigo-600" : "text-gray-600"}>
                {leg.toUserId === currentUserId ? "You" : leg.toUserId.slice(-6)}
              </span>
              <span className="ml-auto text-xs text-gray-400">{leg.region}</span>
            </div>
          ))}
        </div>
      </CardContent>
      {(canAccept || canReject || canCancel) && (
        <CardFooter>
          <div className="flex gap-2">
            {canAccept && (
              <Button size="sm" onClick={() => onAction(id, "accept")}>
                Accept
              </Button>
            )}
            {canReject && (
              <Button size="sm" variant="outline" onClick={() => onAction(id, "reject")}>
                Reject
              </Button>
            )}
            {canCancel && (
              <Button size="sm" variant="destructive" onClick={() => onAction(id, "cancel")}>
                Cancel
              </Button>
            )}
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
