"use client";

import { Badge } from "@/components/ui/badge";

interface ShippingLeg {
  legId: string;
  cardName: string;
  status: string;
  deliveryMethod?: string | null;
  inboundTracking?: string | null;
  outboundTracking?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  returnTracking?: string | null;
  isInternational?: boolean;
  authenticator?: {
    businessName?: string | null;
    businessAddress?: string | null;
    shippingNotes?: string | null;
    acceptsDropOff?: boolean;
    acceptsMail?: boolean;
  } | null;
}

interface ShippingStatusProps {
  legs: ShippingLeg[];
  tradeMode: string;
  tradeStatus: string;
}

const STEP_CONFIG = {
  PENDING: { label: "Awaiting shipment", color: "bg-gray-100 text-gray-700" },
  CARD_RECEIVED: { label: "Card received", color: "bg-blue-100 text-blue-700" },
  PHOTO_REVIEW: { label: "Photo review", color: "bg-yellow-100 text-yellow-700" },
  AUTHENTICATING: { label: "Verifying", color: "bg-orange-100 text-orange-700" },
  VERIFIED: { label: "Verified", color: "bg-emerald-100 text-emerald-700" },
  SHIPPED: { label: "Shipped", color: "bg-blue-100 text-blue-700" },
  DELIVERED: { label: "Delivered", color: "bg-green-100 text-green-700" },
  FAILED: { label: "Failed", color: "bg-red-100 text-red-700" },
};

function TrackingLink({ tracking }: { tracking: string }) {
  return (
    <span className="font-mono text-xs text-blue-600">
      {tracking}
    </span>
  );
}

function ShippingTimeline({ status }: { status: string }) {
  const steps = ["SHIPPED", "DELIVERED"];
  const currentIndex = steps.indexOf(status);

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-1">
          <div
            className={`h-2 w-2 rounded-full ${
              i <= currentIndex ? "bg-green-500" : "bg-gray-300"
            }`}
          />
          <span
            className={`text-[10px] ${
              i <= currentIndex ? "font-medium text-green-700" : "text-gray-400"
            }`}
          >
            {step === "SHIPPED" ? "Shipped" : "Delivered"}
          </span>
          {i < steps.length - 1 && (
            <div
              className={`h-px w-4 ${
                i < currentIndex ? "bg-green-400" : "bg-gray-300"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function ShippingStatus({ legs, tradeMode, tradeStatus }: ShippingStatusProps) {
  const isShippingPhase = ["DELIVERING", "SHIPPING", "DELIVERED", "COMPLETED"].includes(tradeStatus);

  if (!isShippingPhase && !["ESCROWED", "CARDS_SUBMITTED", "AUTHENTICATING", "VERIFIED"].includes(tradeStatus)) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50/50 p-3">
      <p className="text-xs font-medium text-gray-500">Shipping Status</p>
      {legs.map((leg) => {
        const stepConfig = STEP_CONFIG[leg.status as keyof typeof STEP_CONFIG] ?? {
          label: leg.status,
          color: "bg-gray-100 text-gray-700",
        };

        return (
          <div key={leg.legId} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">{leg.cardName}</span>
              <Badge className={stepConfig.color}>{stepConfig.label}</Badge>
            </div>

            {/* Shipping timeline for shipped/delivered legs */}
            {["SHIPPED", "DELIVERED"].includes(leg.status) && (
              <ShippingTimeline status={leg.status} />
            )}

            {/* Tracking numbers */}
            <div className="flex flex-wrap gap-2 text-xs">
              {leg.inboundTracking && (
                <span className="text-gray-500">
                  Inbound: <TrackingLink tracking={leg.inboundTracking} />
                </span>
              )}
              {leg.outboundTracking && (
                <span className="text-gray-500">
                  Outbound: <TrackingLink tracking={leg.outboundTracking} />
                </span>
              )}
              {leg.returnTracking && (
                <span className="text-red-500">
                  Return: <TrackingLink tracking={leg.returnTracking} />
                </span>
              )}
            </div>

            {/* Timestamps */}
            {leg.shippedAt && (
              <p className="text-[10px] text-gray-400">
                Shipped: {new Date(leg.shippedAt).toLocaleDateString()}
              </p>
            )}
            {leg.deliveredAt && (
              <p className="text-[10px] text-gray-400">
                Delivered: {new Date(leg.deliveredAt).toLocaleDateString()}
              </p>
            )}

            {/* Authenticator info for authenticated trades */}
            {tradeMode === "AUTHENTICATED" && leg.authenticator && (
              <div className="rounded bg-white p-2 text-xs text-gray-600">
                <p className="font-medium">{leg.authenticator.businessName ?? "Authenticator"}</p>
                {leg.authenticator.businessAddress && (
                  <p>{leg.authenticator.businessAddress}</p>
                )}
                {leg.authenticator.shippingNotes && (
                  <p className="italic text-gray-400">{leg.authenticator.shippingNotes}</p>
                )}
                <div className="mt-1 flex gap-2">
                  {leg.authenticator.acceptsDropOff && (
                    <Badge className="bg-emerald-50 text-emerald-700 text-[10px]">Drop-off OK</Badge>
                  )}
                  {leg.authenticator.acceptsMail && (
                    <Badge className="bg-blue-50 text-blue-700 text-[10px]">Mail OK</Badge>
                  )}
                </div>
              </div>
            )}

            {/* International badge */}
            {leg.isInternational && (
              <Badge className="bg-amber-100 text-amber-700 text-[10px]">International</Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}
