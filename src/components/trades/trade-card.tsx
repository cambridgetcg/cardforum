"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TradeStatusBadge } from "./trade-status-badge";
import { TradeModeBadge } from "./trade-mode-badge";
import { PhotoApprovalBadge } from "./photo-approval-badge";
import { PhotoUpload } from "./photo-upload";
import { PhotoReview } from "./photo-review";
import { formatRelativeTime } from "@/lib/utils";
import type { TradeStatus, TradeMode, PhotoApprovalStatus } from "@/types/domain";
import { getTradeTransitions, formatPrice } from "@/types/domain";
import { PLATFORM_FEE_RATE } from "@/lib/constants";

interface LegPhotoApproval {
  id: string;
  status: PhotoApprovalStatus;
  photos: string[];
  rejectionNote?: string | null;
  attempts: number;
}

interface TradeCardProps {
  id: string;
  mode?: TradeMode;
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
    trackingNumber?: string | null;
    photoApproval?: LegPhotoApproval | null;
    haveListing?: { askPrice: number; card: { name: string } } | null;
  }[];
  onAction: (tradeId: string, action: "accept" | "reject" | "cancel" | "request-auth") => void;
  onRefresh?: () => void;
}

export function TradeCard({
  id,
  mode = "AUTHENTICATED",
  status,
  createdAt,
  updatedAt,
  currentUserId,
  legs,
  onAction,
  onRefresh,
}: TradeCardProps) {
  const isDirect = mode === "DIRECT";
  const transitions = getTradeTransitions(mode);

  // Compute fee data from legs with ask prices
  const legsWithPrices = legs
    .filter((l) => l.haveListing?.askPrice)
    .map((l) => ({
      fromUserId: l.fromUserId,
      askPrice: l.haveListing!.askPrice,
      cardName: l.haveListing!.card.name,
    }));
  const totalFee = legsWithPrices.reduce(
    (sum, l) => sum + Math.ceil(l.askPrice * PLATFORM_FEE_RATE),
    0,
  );

  const canAccept = status === "PROPOSED" && transitions[status].includes("ACCEPTED");
  const canReject = status === "PROPOSED" && transitions[status].includes("REJECTED");
  const canCancel =
    transitions[status].includes("CANCELLED") &&
    status !== "COMPLETED" &&
    status !== "REJECTED" &&
    status !== "CANCELLED";
  const canRequestAuth = isDirect && ["PROPOSED", "ACCEPTED"].includes(status);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                href={`/trades/${id}`}
                className="font-semibold text-gray-900 hover:text-indigo-600 hover:underline"
              >
                Trade #{id.slice(-6)}
              </Link>
              <TradeModeBadge mode={mode} />
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
          {legs.map((leg) => {
            const pa = leg.photoApproval;
            const isSender = leg.fromUserId === currentUserId;
            const isReceiver = leg.toUserId === currentUserId;
            const showUpload =
              !isDirect &&
              pa &&
              isSender &&
              (pa.status === "PENDING_PHOTOS" || pa.status === "REJECTED");
            const showReview = !isDirect && pa && isReceiver && pa.status === "PENDING_REVIEW";

            return (
              <div key={leg.id} className="space-y-0">
                <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <span className="font-mono text-xs text-gray-400">#{leg.sequence + 1}</span>
                  <span className={isSender ? "font-semibold text-indigo-600" : "text-gray-600"}>
                    {isSender ? "You" : leg.fromUserId.slice(-6)}
                  </span>
                  <span className="text-gray-400">&rarr;</span>
                  <span className={isReceiver ? "font-semibold text-indigo-600" : "text-gray-600"}>
                    {isReceiver ? "You" : leg.toUserId.slice(-6)}
                  </span>
                  {leg.haveListing?.card && (
                    <span className="truncate text-xs text-gray-500">
                      {leg.haveListing.card.name}
                    </span>
                  )}
                  {!isDirect && pa && <PhotoApprovalBadge status={pa.status} />}
                  {leg.trackingNumber && (
                    <span className="text-xs text-blue-600">Tracking: {leg.trackingNumber}</span>
                  )}
                  <span className="ml-auto text-xs text-gray-400">{leg.region}</span>
                </div>

                {showUpload && (
                  <PhotoUpload
                    tradeId={id}
                    legId={leg.id}
                    status={pa.status}
                    rejectionNote={pa.rejectionNote}
                    attempts={pa.attempts}
                    onSubmitted={() => onRefresh?.()}
                  />
                )}

                {showReview && (
                  <PhotoReview
                    tradeId={id}
                    legId={leg.id}
                    photos={pa.photos}
                    attempts={pa.attempts}
                    onReviewed={() => onRefresh?.()}
                  />
                )}
              </div>
            );
          })}
          {/* Fee breakdown */}
          {legsWithPrices.length > 0 && (
            <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2">
              <p className="mb-1 text-xs font-medium text-gray-500">
                Fee Summary (2.2% seller fee)
              </p>
              {legsWithPrices.map((leg, i) => {
                const fee = Math.ceil(leg.askPrice * PLATFORM_FEE_RATE);
                const isSender = leg.fromUserId === currentUserId;
                return (
                  <div key={i} className="flex justify-between text-xs text-gray-500">
                    <span>
                      {leg.cardName} ({formatPrice(leg.askPrice)})
                    </span>
                    <span className={isSender ? "font-medium text-red-500" : ""}>
                      {isSender ? `You pay ${formatPrice(fee)}` : formatPrice(fee)}
                    </span>
                  </div>
                );
              })}
              <div className="mt-1 flex justify-between border-t border-gray-200 pt-1 text-xs font-medium text-gray-700">
                <span>Total platform fees</span>
                <span>{formatPrice(totalFee)}</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
      {(canAccept || canReject || canCancel || canRequestAuth) && (
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
            {canRequestAuth && (
              <Button size="sm" variant="outline" onClick={() => onAction(id, "request-auth")}>
                Request Authenticator Verification
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
