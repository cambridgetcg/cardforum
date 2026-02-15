import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { TradeStatus } from "@/types/domain";

const STATUS_CONFIG: Record<TradeStatus, { label: string; variant: BadgeProps["variant"] }> = {
  PROPOSED: { label: "Proposed", variant: "info" },
  ACCEPTED: { label: "Accepted", variant: "info" },
  ESCROWED: { label: "Escrowed", variant: "warning" },
  CARDS_SUBMITTED: { label: "Cards Submitted", variant: "warning" },
  AUTHENTICATING: { label: "Authenticating", variant: "warning" },
  VERIFIED: { label: "Verified", variant: "success" },
  DELIVERING: { label: "Delivering", variant: "warning" },
  SHIPPING: { label: "Shipping", variant: "warning" },
  DELIVERED: { label: "Delivered", variant: "success" },
  COMPLETED: { label: "Completed", variant: "success" },
  REJECTED: { label: "Rejected", variant: "error" },
  CANCELLED: { label: "Cancelled", variant: "error" },
  DISPUTED: { label: "Disputed", variant: "error" },
};

export function TradeStatusBadge({ status }: { status: TradeStatus }) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: "default" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
