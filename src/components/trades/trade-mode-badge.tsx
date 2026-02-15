import { Badge } from "@/components/ui/badge";
import type { TradeMode } from "@/types/domain";

const MODE_CONFIG: Record<TradeMode, { label: string; variant: "success" | "default" }> = {
  DIRECT: { label: "Direct Trade", variant: "success" },
  AUTHENTICATED: { label: "Verified Trade", variant: "default" },
};

export function TradeModeBadge({ mode }: { mode: TradeMode }) {
  const config = MODE_CONFIG[mode] ?? { label: mode, variant: "default" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
