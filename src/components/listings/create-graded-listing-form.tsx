"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CardSearch } from "./card-search";
import { GRADING_COMPANY_LABELS, TCG_LABELS, type TCG, type GradingCompany } from "@/types/domain";
import { X } from "lucide-react";

interface SelectedCard {
  id: string;
  tcg: TCG;
  name: string;
  setName: string;
  setCode: string | null;
  number: string | null;
}

const COMPANIES: GradingCompany[] = ["PSA", "BGS", "CGC", "SGC"];

// PSA/SGC: integer grades 1–10. BGS/CGC: half-point increments.
const PSA_GRADES = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

export function CreateGradedListingForm({
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
  const [gradingCompany, setGradingCompany] = useState<GradingCompany>("PSA");
  const [grade, setGrade] = useState<number>(9);
  const [minGrade, setMinGrade] = useState<number>(7);
  const [maxGrade, setMaxGrade] = useState<string>("");
  const [certNumber, setCertNumber] = useState("");
  const [price, setPrice] = useState("");
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

    const priceInCents = Math.round(parseFloat(price) * 100);
    if (!priceInCents || priceInCents < 1) {
      setError("Please enter a valid price");
      setLoading(false);
      return;
    }

    const body =
      type === "have"
        ? {
            type: "have",
            cardId: selectedCard.id,
            gradingCompany,
            grade,
            certNumber,
            language: "EN",
            askPrice: priceInCents,
            ...(notes && { notes }),
          }
        : {
            type: "want",
            cardId: selectedCard.id,
            ...(gradingCompany !== "PSA" ? {} : { gradingCompany }),
            minGrade,
            ...(maxGrade && { maxGrade: parseFloat(maxGrade) }),
            bidPrice: priceInCents,
            ...(notes && { notes }),
          };

    try {
      const res = await fetch("/api/graded-listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(
          typeof data.error === "string"
            ? data.error
            : "Failed to create listing",
        );
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
            {type === "have"
              ? "Add Graded Card I Have"
              : "Add Graded Card I Want"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
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
                  <h3 className="font-semibold text-gray-900">
                    {selectedCard.name}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {selectedCard.setName}
                    {selectedCard.setCode && ` (${selectedCard.setCode})`}
                    {selectedCard.number && ` #${selectedCard.number}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{TCG_LABELS[selectedCard.tcg]}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep("card")}
                  >
                    Change
                  </Button>
                </div>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </p>
              )}

              {/* Grading company selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Grading Company
                </label>
                <div className="mt-2 flex gap-2">
                  {COMPANIES.map((c) => (
                    <Button
                      key={c}
                      type="button"
                      variant={gradingCompany === c ? "primary" : "outline"}
                      size="sm"
                      onClick={() => setGradingCompany(c)}
                      disabled={type === "have" && c !== "PSA"}
                      title={
                        type === "have" && c !== "PSA"
                          ? "Only PSA supported in v1"
                          : GRADING_COMPANY_LABELS[c]
                      }
                    >
                      {c}
                    </Button>
                  ))}
                </div>
                {type === "have" && (
                  <p className="mt-1 text-xs text-gray-500">
                    Only PSA slabs supported for cert verification in v1
                  </p>
                )}
              </div>

              {/* Grade selector — differs between have and want */}
              {type === "have" ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    PSA Grade
                  </label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {PSA_GRADES.map((g) => (
                      <Button
                        key={g}
                        type="button"
                        variant={grade === g ? "primary" : "outline"}
                        size="sm"
                        onClick={() => setGrade(g)}
                      >
                        {g}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Minimum Grade
                    </label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {PSA_GRADES.map((g) => (
                        <Button
                          key={g}
                          type="button"
                          variant={minGrade === g ? "primary" : "outline"}
                          size="sm"
                          onClick={() => setMinGrade(g)}
                        >
                          {g}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Max Grade (optional)
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      step={1}
                      value={maxGrade}
                      onChange={(e) => setMaxGrade(e.target.value)}
                      placeholder="Any"
                      className="mt-2 w-20"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Leave empty for &quot;{minGrade} or higher&quot;
                    </p>
                  </div>
                </div>
              )}

              {/* Cert number — only for have listings */}
              {type === "have" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    PSA Cert Number
                  </label>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Found on the slab label (7–10 digit number)
                  </p>
                  <Input
                    type="text"
                    value={certNumber}
                    onChange={(e) =>
                      setCertNumber(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="12345678"
                    className="mt-1 w-40"
                    maxLength={10}
                    required
                  />
                </div>
              )}

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {type === "have" ? "Your Price ($)" : "Max Price ($)"}
                </label>
                <p className="mt-0.5 text-xs text-gray-500">
                  {type === "have"
                    ? "Minimum value you want for this graded card"
                    : "Maximum you'll pay for this graded card"}
                </p>
                <Input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 w-32"
                  required
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
