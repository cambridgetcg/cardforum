"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TradeStatusBadge } from "@/components/trades/trade-status-badge";
import { TradeModeBadge } from "@/components/trades/trade-mode-badge";
import { PhotoApprovalBadge } from "@/components/trades/photo-approval-badge";
import { PhotoUpload } from "@/components/trades/photo-upload";
import { PhotoReview } from "@/components/trades/photo-review";
import { ShippingStatus } from "@/components/shipping/shipping-status";
import { RecordShipment } from "@/components/shipping/record-shipment";
import { DeliveryConfirmation } from "@/components/shipping/delivery-confirmation";
import { ShippingAddressForm } from "@/components/shipping/shipping-address-form";
import { TradePaymentConfirmation } from "@/components/trades/trade-payment-confirmation";
import { formatRelativeTime } from "@/lib/utils";
import { formatPrice, getTradeTransitions } from "@/types/domain";
import type { TradeStatus, TradeMode, PhotoApprovalStatus } from "@/types/domain";
import { PLATFORM_FEE_RATE } from "@/lib/constants";

// ─── Types ────────────────────────────────────────────

interface LegPhotoApproval {
  id: string;
  status: PhotoApprovalStatus;
  photos: string[];
  rejectionNote?: string | null;
  attempts: number;
}

interface LegVerification {
  authenticator?: {
    businessName?: string | null;
    businessAddress?: string | null;
    shippingNotes?: string | null;
    acceptsDropOff?: boolean;
    acceptsMail?: boolean;
  } | null;
}

interface TradeLeg {
  id: string;
  fromUserId: string;
  toUserId: string;
  region: string;
  status: string;
  sequence: number;
  trackingNumber?: string | null;
  outboundTracking?: string | null;
  deliveryMethod?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  isInternational?: boolean;
  returnTracking?: string | null;
  photoApproval?: LegPhotoApproval | null;
  verification?: LegVerification | null;
  shippingAddress?: {
    line1: string;
    line2?: string | null;
    city: string;
    state?: string | null;
    postalCode: string;
    country: string;
  } | null;
  haveListing?: {
    askPrice: number;
    condition: string;
    card: { id: string; name: string; setName: string; number: string; tcg: string };
  } | null;
  gradedHaveListing?: {
    askPrice: number;
    gradingCompany: string;
    grade: number;
    card: { id: string; name: string; setName: string; number: string; tcg: string };
  } | null;
}

interface Trade {
  id: string;
  mode?: TradeMode;
  status: TradeStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  userAId: string;
  userBId: string;
  participantIds: string[];
  statusHistory: { status: string; at: string }[];
  legs: TradeLeg[];
  escrow?: { id: string; status: string; totalAmount: number } | null;
}

interface ShippingAddress {
  id: string;
  label: string;
  line1: string;
  city: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

// ─── Helpers ──────────────────────────────────────────

function getCardName(leg: TradeLeg): string {
  return leg.haveListing?.card?.name ?? leg.gradedHaveListing?.card?.name ?? "Unknown Card";
}

function getCardValue(leg: TradeLeg): number {
  return leg.haveListing?.askPrice ?? leg.gradedHaveListing?.askPrice ?? 0;
}

// ─── Status Timeline ─────────────────────────────────

function StatusTimeline({ history }: { history: { status: string; at: string }[] }) {
  return (
    <div className="space-y-1">
      {history.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
          <span className="font-medium text-gray-700">{entry.status}</span>
          <span className="text-gray-400">
            {new Date(entry.at).toLocaleDateString()}{" "}
            {new Date(entry.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Leg Detail ──────────────────────────────────────

function LegDetail({
  leg,
  trade,
  currentUserId,
  onRefresh,
}: {
  leg: TradeLeg;
  trade: Trade;
  currentUserId: string;
  onRefresh: () => void;
}) {
  const mode = (trade.mode ?? "AUTHENTICATED") as TradeMode;
  const isSender = leg.fromUserId === currentUserId;
  const isReceiver = leg.toUserId === currentUserId;
  const cardName = getCardName(leg);
  const cardValue = getCardValue(leg);
  const fee = Math.ceil(cardValue * PLATFORM_FEE_RATE);

  const pa = leg.photoApproval;
  const isDirect = mode === "DIRECT";

  // Photo approval conditions
  const showUpload =
    !isDirect && pa && isSender && (pa.status === "PENDING_PHOTOS" || pa.status === "REJECTED");
  const showReview = !isDirect && pa && isReceiver && pa.status === "PENDING_REVIEW";

  // Shipping conditions
  const isShippingPhase = ["DELIVERING", "SHIPPING", "DELIVERED", "COMPLETED"].includes(
    trade.status,
  );
  const legIsShipped = leg.status === "SHIPPED";
  const legIsDelivered = leg.status === "DELIVERED";

  // Who can ship?
  // Authenticated: authenticator ships (outbound). Not handled here — authenticator has their own dashboard.
  // Direct: sender ships.
  const canRecordShipment =
    isDirect && isSender && leg.status === "PENDING" && ["SHIPPING"].includes(trade.status);

  // Who can confirm delivery? Receiver, when leg is SHIPPED.
  const canConfirmDelivery = isReceiver && legIsShipped;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
              {leg.sequence + 1}
            </span>
            <div>
              <p className="font-medium text-gray-900">{cardName}</p>
              <p className="text-xs text-gray-500">
                {leg.haveListing?.condition ??
                  (leg.gradedHaveListing
                    ? `${leg.gradedHaveListing.gradingCompany} ${leg.gradedHaveListing.grade}`
                    : "")}{" "}
                &middot; {formatPrice(cardValue)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              className={
                legIsDelivered
                  ? "bg-green-100 text-green-700"
                  : legIsShipped
                    ? "bg-blue-100 text-blue-700"
                    : leg.status === "VERIFIED"
                      ? "bg-emerald-100 text-emerald-700"
                      : leg.status === "FAILED"
                        ? "bg-red-100 text-red-700"
                        : "bg-gray-100 text-gray-700"
              }
            >
              {leg.status}
            </Badge>
            {leg.isInternational && (
              <Badge className="bg-amber-100 text-amber-700">International</Badge>
            )}
          </div>
        </div>

        {/* Flow: sender → receiver */}
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
          <span className={isSender ? "font-semibold text-indigo-600" : "text-gray-600"}>
            {isSender ? "You" : `User ...${leg.fromUserId.slice(-4)}`}
          </span>
          <span className="text-gray-400">&rarr;</span>
          <span className={isReceiver ? "font-semibold text-indigo-600" : "text-gray-600"}>
            {isReceiver ? "You" : `User ...${leg.toUserId.slice(-4)}`}
          </span>
          {isSender && (
            <span className="ml-auto text-xs text-red-500">Fee: {formatPrice(fee)}</span>
          )}
        </div>

        {/* Tracking info */}
        {(leg.trackingNumber || leg.outboundTracking) && (
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            {leg.trackingNumber && (
              <span className="text-gray-500">
                {isDirect ? "Tracking" : "Inbound"}:{" "}
                <span className="font-mono text-blue-600">{leg.trackingNumber}</span>
              </span>
            )}
            {leg.outboundTracking && (
              <span className="text-gray-500">
                Outbound: <span className="font-mono text-blue-600">{leg.outboundTracking}</span>
              </span>
            )}
            {leg.returnTracking && (
              <span className="text-red-500">
                Return: <span className="font-mono text-red-600">{leg.returnTracking}</span>
              </span>
            )}
          </div>
        )}

        {/* Timestamps */}
        {(leg.shippedAt || leg.deliveredAt) && (
          <div className="mt-1 flex gap-4 text-[10px] text-gray-400">
            {leg.shippedAt && <span>Shipped: {new Date(leg.shippedAt).toLocaleDateString()}</span>}
            {leg.deliveredAt && (
              <span>Delivered: {new Date(leg.deliveredAt).toLocaleDateString()}</span>
            )}
          </div>
        )}

        {/* Authenticator info */}
        {mode === "AUTHENTICATED" && leg.verification?.authenticator && (
          <div className="mt-3 rounded-lg border border-gray-100 bg-white p-3 text-xs text-gray-600">
            <p className="font-medium text-gray-800">
              {leg.verification.authenticator.businessName ?? "Authenticator"}
            </p>
            {leg.verification.authenticator.businessAddress && (
              <p className="mt-0.5">{leg.verification.authenticator.businessAddress}</p>
            )}
            {leg.verification.authenticator.shippingNotes && (
              <p className="mt-0.5 text-gray-400 italic">
                {leg.verification.authenticator.shippingNotes}
              </p>
            )}
            <div className="mt-1.5 flex gap-2">
              {leg.verification.authenticator.acceptsDropOff && (
                <Badge className="bg-emerald-50 text-[10px] text-emerald-700">Drop-off OK</Badge>
              )}
              {leg.verification.authenticator.acceptsMail && (
                <Badge className="bg-blue-50 text-[10px] text-blue-700">Mail OK</Badge>
              )}
            </div>
          </div>
        )}

        {/* Photo approval */}
        {!isDirect && pa && (
          <div className="mt-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs text-gray-500">Photo Approval:</span>
              <PhotoApprovalBadge status={pa.status} />
            </div>
            {showUpload && (
              <PhotoUpload
                tradeId={trade.id}
                legId={leg.id}
                status={pa.status}
                rejectionNote={pa.rejectionNote}
                attempts={pa.attempts}
                onSubmitted={onRefresh}
              />
            )}
            {showReview && (
              <PhotoReview
                tradeId={trade.id}
                legId={leg.id}
                photos={pa.photos}
                attempts={pa.attempts}
                onReviewed={onRefresh}
              />
            )}
          </div>
        )}

        {/* Record Shipment (direct mode: sender ships) */}
        {canRecordShipment && (
          <div className="mt-3">
            <RecordShipment
              tradeId={trade.id}
              legId={leg.id}
              cardName={cardName}
              role="sender"
              onRecorded={onRefresh}
            />
          </div>
        )}

        {/* Confirm Delivery (receiver confirms) */}
        {canConfirmDelivery && (
          <div className="mt-3">
            <DeliveryConfirmation
              tradeId={trade.id}
              legId={leg.id}
              cardName={cardName}
              onConfirmed={onRefresh}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────

export default function TradeDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const tradeId = params.tradeId as string;

  const [trade, setTrade] = useState<Trade | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);

  const currentUserId = session?.user?.id ?? "";

  const fetchTrade = useCallback(async () => {
    try {
      const res = await fetch(`/api/trades/${tradeId}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to load trade");
        return;
      }
      const data = await res.json();
      setTrade(data.trade);
    } catch {
      setError("Failed to load trade");
    } finally {
      setLoading(false);
    }
  }, [tradeId]);

  const fetchAddresses = useCallback(async () => {
    const res = await fetch("/api/users/address");
    if (res.ok) {
      const data = await res.json();
      setAddresses(data.addresses);
    }
  }, []);

  useEffect(() => {
    fetchTrade();
    fetchAddresses();
  }, [fetchTrade, fetchAddresses]);

  async function handleAction(action: "accept" | "reject" | "cancel" | "request-auth") {
    setActionLoading(true);
    try {
      if (action === "request-auth") {
        await fetch(`/api/trades/${tradeId}/request-auth`, { method: "POST" });
      } else {
        await fetch("/api/trades", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tradeId, action }),
        });
      }
      fetchTrade();
    } catch {
      // Error handled by re-fetch
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-gray-500">Loading trade...</p>
      </div>
    );
  }

  if (error || !trade) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error ?? "Trade not found"}
        </div>
        <Link href="/trades" className="mt-4 inline-block text-sm text-indigo-600 hover:underline">
          &larr; Back to trades
        </Link>
      </div>
    );
  }

  const mode = (trade.mode ?? "AUTHENTICATED") as TradeMode;
  const isDirect = mode === "DIRECT";
  const transitions = getTradeTransitions(mode);
  const canAccept = trade.status === "PROPOSED" && transitions[trade.status].includes("ACCEPTED");
  const canReject = trade.status === "PROPOSED" && transitions[trade.status].includes("REJECTED");
  const canCancel =
    transitions[trade.status].includes("CANCELLED") &&
    !["COMPLETED", "REJECTED", "CANCELLED"].includes(trade.status);
  const canRequestAuth = isDirect && ["PROPOSED", "ACCEPTED"].includes(trade.status);

  const isPreEscrow = ["PROPOSED", "ACCEPTED"].includes(trade.status);
  const needsAddress = isPreEscrow && addresses.length === 0;

  const totalValue = trade.legs.reduce((sum, leg) => sum + getCardValue(leg), 0);
  const totalFees = trade.legs.reduce(
    (sum, leg) => sum + Math.ceil(getCardValue(leg) * PLATFORM_FEE_RATE),
    0,
  );

  // Build shipping leg data for the ShippingStatus component
  const shippingLegs = trade.legs.map((leg) => ({
    legId: leg.id,
    cardName: getCardName(leg),
    status: leg.status,
    deliveryMethod: leg.deliveryMethod,
    inboundTracking: leg.trackingNumber,
    outboundTracking: leg.outboundTracking,
    shippedAt: leg.shippedAt,
    deliveredAt: leg.deliveredAt,
    returnTracking: leg.returnTracking,
    isInternational: leg.isInternational,
    authenticator: leg.verification?.authenticator ?? null,
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link href="/trades" className="text-sm text-indigo-600 hover:underline">
        &larr; Back to trades
      </Link>

      {/* Header */}
      <div className="mt-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Trade #{trade.id.slice(-6)}</h1>
            <TradeModeBadge mode={mode} />
            <TradeStatusBadge status={trade.status} />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Created {formatRelativeTime(new Date(trade.createdAt))} &middot; Updated{" "}
            {formatRelativeTime(new Date(trade.updatedAt))}
            {trade.completedAt && (
              <> &middot; Completed {new Date(trade.completedAt).toLocaleDateString()}</>
            )}
          </p>
        </div>
      </div>

      {/* Address warning for pre-escrow trades */}
      {needsAddress && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">Shipping address required</p>
          <p className="mt-1 text-xs text-amber-600">
            You need a shipping address before this trade can be escrowed. Add one below.
          </p>
          <Button size="sm" className="mt-2" onClick={() => setShowAddressForm(true)}>
            Add Shipping Address
          </Button>
        </div>
      )}

      {/* Address form modal */}
      {showAddressForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Shipping Address</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowAddressForm(false)}>
                &times;
              </Button>
            </div>
            <ShippingAddressForm
              onSaved={() => {
                setShowAddressForm(false);
                fetchAddresses();
              }}
            />
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Main content: legs */}
        <div className="space-y-4 lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900">Trade Legs ({trade.legs.length})</h2>

          {trade.legs.map((leg) => (
            <LegDetail
              key={leg.id}
              leg={leg}
              trade={trade}
              currentUserId={currentUserId}
              onRefresh={fetchTrade}
            />
          ))}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Actions */}
          {(canAccept || canReject || canCancel || canRequestAuth) && (
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold text-gray-900">Actions</h3>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {canAccept && (
                    <Button
                      onClick={() => handleAction("accept")}
                      disabled={actionLoading || needsAddress}
                    >
                      {actionLoading ? "Processing..." : "Accept Trade"}
                    </Button>
                  )}
                  {canRequestAuth && (
                    <Button
                      variant="outline"
                      onClick={() => handleAction("request-auth")}
                      disabled={actionLoading}
                    >
                      Request Authentication
                    </Button>
                  )}
                  {canReject && (
                    <Button
                      variant="outline"
                      onClick={() => handleAction("reject")}
                      disabled={actionLoading}
                    >
                      Reject
                    </Button>
                  )}
                  {canCancel && (
                    <Button
                      variant="destructive"
                      onClick={() => handleAction("cancel")}
                      disabled={actionLoading}
                    >
                      Cancel Trade
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment authorization (DIRECT trades, ESCROWED+) */}
          {isDirect &&
            !["PROPOSED", "ACCEPTED", "REJECTED", "CANCELLED"].includes(trade.status) && (
              <TradePaymentConfirmation
                tradeId={trade.id}
                tradeStatus={trade.status}
                onPaymentConfirmed={fetchTrade}
              />
            )}

          {/* Trade summary */}
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-gray-900">Summary</h3>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total value</span>
                  <span className="font-medium">{formatPrice(totalValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Platform fees (2.2%)</span>
                  <span className="font-medium">{formatPrice(totalFees)}</span>
                </div>
                {trade.escrow && (
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-gray-500">Escrow</span>
                    <div className="text-right">
                      <span className="font-medium">{formatPrice(trade.escrow.totalAmount)}</span>
                      <Badge className="ml-2 bg-gray-100 text-[10px] text-gray-600">
                        {trade.escrow.status}
                      </Badge>
                    </div>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Mode</span>
                  <span className="font-medium">{isDirect ? "Direct" : "Authenticated"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Participants</span>
                  <span className="font-medium">{trade.participantIds.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shipping overview */}
          <ShippingStatus legs={shippingLegs} tradeMode={mode} tradeStatus={trade.status} />

          {/* Shipping address */}
          {addresses.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Your Address</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddressForm(true)}
                    className="text-xs"
                  >
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {addresses
                  .filter((a) => a.isDefault)
                  .map((addr) => (
                    <div key={addr.id} className="text-sm text-gray-600">
                      <p className="font-medium text-gray-800">{addr.label}</p>
                      <p>{addr.line1}</p>
                      <p>
                        {addr.city}, {addr.postalCode}
                      </p>
                      <p>{addr.country}</p>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}

          {/* Status history */}
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-gray-900">History</h3>
            </CardHeader>
            <CardContent>
              <StatusTimeline history={trade.statusHistory ?? []} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
