"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CardSearch } from "./card-search";
import { CONDITION_LABELS, TCG_LABELS, type TCG, type Condition } from "@/types/domain";
import { X } from "lucide-react";

interface SelectedCard {
  id: string;
  tcg: TCG;
  name: string;
  setName: string;
  setCode: string | null;
  number: string | null;
}

const CONDITIONS: Condition[] = ["NM", "LP", "MP", "HP", "DMG"];

export function CreateListingForm({
  type,
  onClose,
  onCreated,
}: {
  type: "have" | "want";
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<"card" | "details">("card");
  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(null);
  const [condition, setCondition] = useState<Condition>("NM");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleCardSelect(card: SelectedCard) {
    setSelectedCard(card);
    setStep("details");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCard) return;
    setLoading(true);
    setError("");

    const body = {
      type,
      cardId: selectedCard.id,
      ...(type === "have"
        ? { condition, quantity, language: "EN" }
        : { minCondition: condition, maxQuantity: quantity }),
      ...(notes && { notes }),
    };

    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(typeof data.error === "string" ? data.error : "Failed to create listing");
        return;
      }
      onCreated();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-20">
      <div className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {type === "have" ? "Add Card I Have" : "Add Card I Want"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
          {step === "card" && (
            <CardSearch onSelect={handleCardSelect} mode="select" />
          )}

          {step === "details" && selectedCard && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Selected card preview */}
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedCard.name}</h3>
                  <p className="text-sm text-gray-600">
                    {selectedCard.setName}
                    {selectedCard.setCode && ` (${selectedCard.setCode})`}
                    {selectedCard.number && ` #${selectedCard.number}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{TCG_LABELS[selectedCard.tcg]}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => setStep("card")}>
                    Change
                  </Button>
                </div>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
              )}

              {/* Condition selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {type === "have" ? "Card Condition" : "Minimum Condition"}
                </label>
                <div className="mt-2 flex gap-2">
                  {CONDITIONS.map((c) => (
                    <Button
                      key={c}
                      type="button"
                      variant={condition === c ? "primary" : "outline"}
                      size="sm"
                      onClick={() => setCondition(c)}
                    >
                      {c}
                      <span className="ml-1 hidden text-xs opacity-70 sm:inline">
                        {CONDITION_LABELS[c]}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>

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
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="mt-1 w-24"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Notes (optional)
                </label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any specifics about this listing..."
                  className="mt-1"
                  maxLength={500}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Creating..." : "Create Listing"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
