"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp } from "lucide-react";

const CARD_LANGUAGES = [
  { value: "EN", label: "English" },
  { value: "JP", label: "Japanese" },
  { value: "DE", label: "German" },
  { value: "FR", label: "French" },
  { value: "ES", label: "Spanish" },
  { value: "IT", label: "Italian" },
  { value: "PT", label: "Portuguese" },
  { value: "KO", label: "Korean" },
  { value: "ZH", label: "Chinese" },
] as const;

interface AdvancedFieldsProps {
  type: "have" | "want";
  quantity: number;
  onQuantityChange: (qty: number) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  language: string;
  onLanguageChange: (lang: string) => void;
  autoAccept: boolean;
  onAutoAcceptChange: (accept: boolean) => void;
  autoAcceptMaxGap: string;
  onAutoAcceptMaxGapChange: (gap: string) => void;
  autoAcceptMaxCycleLength: number;
  onAutoAcceptMaxCycleLengthChange: (len: number) => void;
}

export function AdvancedFields({
  type,
  quantity,
  onQuantityChange,
  notes,
  onNotesChange,
  language,
  onLanguageChange,
  autoAccept,
  onAutoAcceptChange,
  autoAcceptMaxGap,
  onAutoAcceptMaxGapChange,
  autoAcceptMaxCycleLength,
  onAutoAcceptMaxCycleLengthChange,
}: AdvancedFieldsProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-t border-gray-100 pt-3">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <span>Advanced options</span>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-4">
          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {type === "have" ? "Quantity" : "Max Quantity"}
            </label>
            <Input
              type="number"
              min={1}
              max={99}
              value={quantity}
              onChange={(e) => onQuantityChange(Math.max(1, Math.min(99, Number(e.target.value))))}
              className="mt-1 w-24"
            />
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Card Language</label>
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value)}
              className="mt-1 h-10 w-40 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:outline-none"
            >
              {CARD_LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Notes</label>
            <div className="relative mt-1">
              <textarea
                value={notes}
                onChange={(e) => onNotesChange(e.target.value.slice(0, 500))}
                maxLength={500}
                placeholder="Any specifics about this listing..."
                rows={3}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:outline-none"
              />
              <span className="absolute right-2 bottom-2 text-xs text-gray-400">
                {notes.length}/500
              </span>
            </div>
          </div>

          {/* Auto-accept */}
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoAccept}
                onChange={(e) => onAutoAcceptChange(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-gray-700">Auto-accept matching trades</span>
            </label>
            <p className="mt-0.5 ml-6 text-xs text-gray-500">
              Automatically accept when a compatible trade is found
            </p>

            {autoAccept && (
              <div className="mt-3 ml-6 space-y-3 rounded-lg bg-gray-50 p-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600">Max price gap</label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={autoAcceptMaxGap}
                    onChange={(e) => onAutoAcceptMaxGapChange(e.target.value)}
                    placeholder="0.00"
                    className="mt-1 w-28"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600">
                    Max cycle length
                  </label>
                  <Input
                    type="number"
                    min={2}
                    max={10}
                    value={autoAcceptMaxCycleLength}
                    onChange={(e) => onAutoAcceptMaxCycleLengthChange(Number(e.target.value))}
                    className="mt-1 w-20"
                  />
                  <p className="mt-0.5 text-xs text-gray-400">
                    Maximum number of traders in a cycle (2-10)
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
