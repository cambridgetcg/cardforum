import { db } from "@/lib/db";

// ─── Carrier Adapter Interface ──────────────────────────

export interface TrackingStatus {
  carrier: string;
  trackingNumber: string;
  status:
    | "PRE_TRANSIT"
    | "IN_TRANSIT"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED"
    | "FAILED"
    | "RETURNED"
    | "UNKNOWN";
  statusDetail: string;
  estimatedDelivery: string | null;
  lastUpdate: string;
  location: string | null;
}

interface CarrierAdapter {
  name: string;
  detectCarrier(trackingNumber: string): boolean;
  getStatus(trackingNumber: string): Promise<TrackingStatus>;
  registerWebhook?(trackingNumber: string, callbackUrl: string): Promise<string>;
}

// ─── Carrier Adapters ───────────────────────────────────

/**
 * Generic adapter that works with EasyPost, AfterShip, or similar APIs.
 * Reads CARRIER_TRACKING_API_KEY and CARRIER_TRACKING_PROVIDER from env.
 */
class GenericCarrierAdapter implements CarrierAdapter {
  name = "generic";

  detectCarrier(_trackingNumber: string): boolean {
    return true; // Catch-all
  }

  async getStatus(trackingNumber: string): Promise<TrackingStatus> {
    const provider = process.env.CARRIER_TRACKING_PROVIDER ?? "aftership";
    const apiKey = process.env.CARRIER_TRACKING_API_KEY;

    if (!apiKey) {
      return {
        carrier: "unknown",
        trackingNumber,
        status: "UNKNOWN",
        statusDetail: "Carrier tracking not configured",
        estimatedDelivery: null,
        lastUpdate: new Date().toISOString(),
        location: null,
      };
    }

    if (provider === "aftership") {
      return this.getAfterShipStatus(trackingNumber, apiKey);
    }

    // Default: return unknown if provider not recognized
    return {
      carrier: "unknown",
      trackingNumber,
      status: "UNKNOWN",
      statusDetail: `Unsupported provider: ${provider}`,
      estimatedDelivery: null,
      lastUpdate: new Date().toISOString(),
      location: null,
    };
  }

  private async getAfterShipStatus(
    trackingNumber: string,
    apiKey: string,
  ): Promise<TrackingStatus> {
    const res = await fetch(`https://api.aftership.com/v4/trackings/${trackingNumber}`, {
      headers: {
        "aftership-api-key": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      return {
        carrier: "unknown",
        trackingNumber,
        status: "UNKNOWN",
        statusDetail: `AfterShip API error: ${res.status}`,
        estimatedDelivery: null,
        lastUpdate: new Date().toISOString(),
        location: null,
      };
    }

    const data = await res.json();
    const tracking = data.data?.tracking;

    return {
      carrier: tracking?.slug ?? "unknown",
      trackingNumber,
      status: mapAfterShipStatus(tracking?.tag ?? ""),
      statusDetail: tracking?.subtag_message ?? tracking?.tag ?? "Unknown",
      estimatedDelivery: tracking?.expected_delivery ?? null,
      lastUpdate: tracking?.updated_at ?? new Date().toISOString(),
      location: tracking?.checkpoints?.[0]?.location ?? null,
    };
  }
}

function mapAfterShipStatus(tag: string): TrackingStatus["status"] {
  switch (tag) {
    case "InfoReceived":
      return "PRE_TRANSIT";
    case "InTransit":
      return "IN_TRANSIT";
    case "OutForDelivery":
      return "OUT_FOR_DELIVERY";
    case "Delivered":
      return "DELIVERED";
    case "AvailableForPickup":
      return "OUT_FOR_DELIVERY";
    case "AttemptFail":
      return "FAILED";
    case "Exception":
      return "FAILED";
    case "Expired":
      return "FAILED";
    default:
      return "UNKNOWN";
  }
}

// ─── Service ────────────────────────────────────────────

const adapters: CarrierAdapter[] = [new GenericCarrierAdapter()];

function getAdapter(trackingNumber: string): CarrierAdapter {
  return adapters.find((a) => a.detectCarrier(trackingNumber)) ?? adapters[0];
}

/**
 * Get tracking status for a shipment.
 */
export async function getTrackingStatus(trackingNumber: string): Promise<TrackingStatus> {
  const adapter = getAdapter(trackingNumber);
  return adapter.getStatus(trackingNumber);
}

/**
 * Check all shipped legs for delivery and auto-confirm.
 * Called by /api/cron/carrier-tracking.
 *
 * For each SHIPPED leg with a tracking number:
 * 1. Query carrier API for current status
 * 2. If DELIVERED, auto-confirm delivery
 * 3. Store tracking event for audit
 */
export async function checkAndAutoConfirmDeliveries(): Promise<{
  checked: number;
  confirmed: string[];
}> {
  const shippedLegs = await db.tradeLeg.findMany({
    where: {
      status: "SHIPPED",
      outboundTracking: { not: null },
    },
    select: {
      id: true,
      toUserId: true,
      outboundTracking: true,
      trade: { select: { id: true, status: true } },
    },
  });

  const confirmed: string[] = [];

  for (const leg of shippedLegs) {
    if (!leg.outboundTracking) continue;

    try {
      const status = await getTrackingStatus(leg.outboundTracking);

      // Store tracking event
      await db.tradeLeg.update({
        where: { id: leg.id },
        data: {
          deliveryPhotos: [
            JSON.stringify({
              status: status.status,
              detail: status.statusDetail,
              location: status.location,
              checkedAt: new Date().toISOString(),
            }),
          ],
        },
      });

      if (status.status === "DELIVERED") {
        // Auto-confirm delivery
        await db.tradeLeg.update({
          where: { id: leg.id },
          data: {
            status: "DELIVERED",
            deliveredAt: new Date(),
          },
        });

        confirmed.push(leg.id);
      }
    } catch {
      // Skip failed tracking checks — will retry on next cron
    }
  }

  return { checked: shippedLegs.length, confirmed };
}

/**
 * Get tracking info for a specific leg (user-facing).
 */
export async function getLegTrackingStatus(tradeLegId: string): Promise<TrackingStatus | null> {
  const leg = await db.tradeLeg.findUnique({
    where: { id: tradeLegId },
    select: { outboundTracking: true },
  });

  if (!leg?.outboundTracking) return null;
  return getTrackingStatus(leg.outboundTracking);
}
