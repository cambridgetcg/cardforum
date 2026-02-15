import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { DigitisationStatus } from "@/types/domain";

const STATUS_CONFIG: Record<DigitisationStatus, { label: string; variant: BadgeProps["variant"] }> = {
  SUBMITTED: { label: "Submitted", variant: "info" },
  RECEIVED: { label: "Received", variant: "info" },
  VERIFYING: { label: "Verifying", variant: "warning" },
  VERIFIED: { label: "Verified", variant: "success" },
  MINTED: { label: "Minted", variant: "success" },
  REJECTED: { label: "Rejected", variant: "error" },
  CANCELLED: { label: "Cancelled", variant: "error" },
};

export function DigitisationStatusBadge({ status }: { status: DigitisationStatus }) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: "default" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
