"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, X } from "lucide-react";
import { IntentPanel } from "./intent-panel";

export function ListingFAB() {
  const { status } = useSession();
  const [expanded, setExpanded] = useState(false);
  const [intentType, setIntentType] = useState<"have" | "want" | null>(null);

  if (status !== "authenticated") return null;

  return (
    <>
      {/* Speed dial */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col-reverse items-end gap-2">
        {expanded && (
          <>
            <button
              onClick={() => { setIntentType("have"); setExpanded(false); }}
              className="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:bg-emerald-700"
            >
              I Have
            </button>
            <button
              onClick={() => { setIntentType("want"); setExpanded(false); }}
              className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:bg-blue-700"
            >
              I Want
            </button>
          </>
        )}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition-transform hover:bg-indigo-700 active:scale-95"
          aria-label={expanded ? "Close menu" : "Create listing"}
        >
          {expanded ? (
            <X className="h-6 w-6" />
          ) : (
            <Plus className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* IntentPanel with no pre-selected card (shows card search) */}
      <IntentPanel
        open={intentType !== null}
        card={null}
        type={intentType ?? "have"}
        onClose={() => setIntentType(null)}
        onCreated={() => setIntentType(null)}
      />
    </>
  );
}
