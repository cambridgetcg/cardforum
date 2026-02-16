import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { DigitalTokenStatus } from "@/types/domain";

const STATUS_CONFIG: Record<DigitalTokenStatus, { label: string; variant: BadgeProps["variant"] }> =
  {
    ACTIVE: { label: "Active", variant: "success" },
    LISTED: { label: "Listed", variant: "info" },
    TRADE_LOCKED: { label: "Trade Locked", variant: "warning" },
    REDEMPTION_PENDING: { label: "Redeeming", variant: "warning" },
    REDEEMED: { label: "Redeemed", variant: "default" },
    BURNED: { label: "Burned", variant: "error" },
  };

export function DigitalTokenStatusBadge({ status }: { status: DigitalTokenStatus }) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: "default" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
