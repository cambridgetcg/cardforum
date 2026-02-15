import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { RedemptionStatus } from "@/types/domain";

const STATUS_CONFIG: Record<RedemptionStatus, { label: string; variant: BadgeProps["variant"] }> = {
  REQUESTED: { label: "Requested", variant: "info" },
  STOCK_RESERVED: { label: "Stock Reserved", variant: "info" },
  PREPARING: { label: "Preparing", variant: "warning" },
  SHIPPED: { label: "Shipped", variant: "warning" },
  DELIVERED: { label: "Delivered", variant: "success" },
  COMPLETED: { label: "Completed", variant: "success" },
  FAILED: { label: "Failed", variant: "error" },
  CANCELLED: { label: "Cancelled", variant: "error" },
};

export function RedemptionStatusBadge({ status }: { status: RedemptionStatus }) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: "default" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
