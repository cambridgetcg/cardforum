"use client";

import { Button } from "@/components/ui/button";
import { CONDITION_LABELS, type Condition } from "@/types/domain";
import { cn } from "@/lib/utils";

const CONDITIONS: Condition[] = ["NM", "LP", "MP", "HP", "DMG"];

interface ConditionPickerProps {
  value: Condition;
  onChange: (condition: Condition) => void;
  type: "have" | "want";
  aiSuggestion?: Condition | null;
}

export function ConditionPicker({ value, onChange, type, aiSuggestion }: ConditionPickerProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">
        {type === "have" ? "Condition" : "Minimum Condition"}
      </label>
      <p className="mt-0.5 text-xs text-gray-500">
        {type === "have" ? "How would you describe this card?" : "Minimum condition you'll accept"}
      </p>
      <div className="mt-2 flex gap-1.5">
        {CONDITIONS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={cn(
              "relative flex flex-1 flex-col items-center rounded-lg border px-1 py-2 text-center text-sm font-medium transition-colors",
              value === c
                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50",
            )}
          >
            <span className="text-sm font-semibold">{c}</span>
            <span className="mt-0.5 hidden text-[10px] font-normal opacity-70 sm:block">
              {CONDITION_LABELS[c]}
            </span>
            {aiSuggestion === c && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[8px] text-white">
                AI
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
