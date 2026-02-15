import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { PhotoApprovalStatus } from "@/types/domain";

const STATUS_CONFIG: Record<
  PhotoApprovalStatus,
  { label: string; variant: BadgeProps["variant"] }
> = {
  PENDING_PHOTOS: { label: "Photos Needed", variant: "warning" },
  PENDING_REVIEW: { label: "Awaiting Review", variant: "info" },
  APPROVED: { label: "Approved", variant: "success" },
  REJECTED: { label: "Rejected", variant: "error" },
};

export function PhotoApprovalBadge({ status }: { status: PhotoApprovalStatus }) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: "default" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
