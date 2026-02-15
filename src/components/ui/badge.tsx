import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "error" | "info";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        {
          "bg-badge-default-bg text-badge-default-fg": variant === "default",
          "bg-badge-success-bg text-badge-success-fg": variant === "success",
          "bg-badge-warning-bg text-badge-warning-fg": variant === "warning",
          "bg-badge-error-bg text-badge-error-fg": variant === "error",
          "bg-badge-info-bg text-badge-info-fg": variant === "info",
        },
        className
      )}
      {...props}
    />
  );
}
