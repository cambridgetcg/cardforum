import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:ring-primary-ring":
              variant === "primary",
            "bg-secondary text-secondary-foreground hover:bg-secondary-hover focus-visible:ring-muted":
              variant === "secondary",
            "border border-border bg-transparent hover:bg-secondary focus-visible:ring-muted":
              variant === "outline",
            "bg-transparent hover:bg-secondary focus-visible:ring-muted":
              variant === "ghost",
            "bg-destructive text-destructive-foreground hover:bg-destructive-hover focus-visible:ring-destructive-ring":
              variant === "destructive",
          },
          {
            "h-8 px-3 text-sm": size === "sm",
            "h-10 px-4 text-sm": size === "md",
            "h-12 px-6 text-base": size === "lg",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
