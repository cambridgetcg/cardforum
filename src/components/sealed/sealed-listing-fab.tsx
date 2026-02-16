"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SealedIntentPanel } from "./sealed-intent-panel";
import { Plus, ArrowUpRight, ArrowDownLeft } from "lucide-react";

interface SealedListingFabProps {
  onCreated?: () => void;
}

export function SealedListingFab({ onCreated }: SealedListingFabProps) {
  const [expanded, setExpanded] = useState(false);
  const [intentType, setIntentType] = useState<"have" | "want" | null>(null);

  const handleSelect = (type: "have" | "want") => {
    setIntentType(type);
    setExpanded(false);
  };

  return (
    <>
      <div className="fixed right-6 bottom-6 z-40 flex flex-col items-end gap-2">
        {expanded && (
          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleSelect("have")}
              className="gap-1.5 shadow-lg"
            >
              <ArrowUpRight className="h-4 w-4" />I Have (Sell)
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleSelect("want")}
              className="gap-1.5 shadow-lg"
            >
              <ArrowDownLeft className="h-4 w-4" />I Want (Buy)
            </Button>
          </div>
        )}
        <Button
          size="lg"
          onClick={() => setExpanded(!expanded)}
          className="h-14 w-14 rounded-full shadow-lg"
        >
          <Plus className={`h-6 w-6 transition-transform ${expanded ? "rotate-45" : ""}`} />
        </Button>
      </div>

      <SealedIntentPanel
        open={intentType !== null}
        product={null}
        type={intentType ?? "have"}
        onClose={() => setIntentType(null)}
        onCreated={() => {
          setIntentType(null);
          onCreated?.();
        }}
      />
    </>
  );
}
