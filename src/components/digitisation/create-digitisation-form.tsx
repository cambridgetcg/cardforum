"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CardSearch } from "@/components/listings/card-search";
import { CONDITION_LABELS, TCG_LABELS, formatPrice, type TCG, type Condition } from "@/types/domain";
import { X } from "lucide-react";

interface SelectedCard {
  id: string;
  tcg: TCG;
  name: string;
  setName: string;
  setCode: string | null;
  number: string | null;
}

interface VaultOption {
  id: string;
  businessName: string | null;
  region: string;
}

const CONDITIONS: Condition[] = ["NM", "LP", "MP", "HP", "DMG"];

export function CreateDigitisationForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<"card" | "details">("card");
  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(null);
  const [condition, setCondition] = useState<Condition>("NM");
  const [authenticatorId, setAuthenticatorId] = useState("");
  const [trackingInbound, setTrackingInbound] = useState("");
  const [vaults, setVaults] = useState<VaultOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch vault operators
  useEffect(() => {
    fetch("/api/authenticator?vault=true")
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.authenticators ?? [];
        setVaults(list);
        if (list.length > 0) setAuthenticatorId(list[0].id);
      })
      .catch(() => setVaults([]));
  }, []);

  function handleCardSelect(card: SelectedCard) {
    setSelectedCard(card);
    setStep("details");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCard || !authenticatorId) return;
    setLoading(true);
    setError("");

    // Verification fee = authenticator base fee (we use a fixed amount for digitisation)
    const verificationFeeCents = 500; // $5.00 default

    const body = {
      cardId: selectedCard.id,
      condition,
      language: "EN",
      authenticatorId,
      verificationFeeCents,
      ...(trackingInbound && { trackingInbound }),
    };

    try {
      const res = await fetch("/api/digitisation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(typeof data.error === "string" ? data.error : "Failed to create request");
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
          <h2 className="text-lg font-semibold text-gray-900">Digitise a Card</h2>
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
                  Card Condition
                </label>
                <p className="mt-0.5 text-xs text-gray-500">
                  Declare the condition — the vault authenticator will verify
                </p>
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

              {/* Vault selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Vault Authenticator
                </label>
                <p className="mt-0.5 text-xs text-gray-500">
                  Ship your card to this vault for verification and custody
                </p>
                {vaults.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-400">No vault operators available</p>
                ) : (
                  <select
                    value={authenticatorId}
                    onChange={(e) => setAuthenticatorId(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  >
                    {vaults.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.businessName ?? "Vault"} — {v.region}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Tracking number */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Inbound Tracking Number (optional)
                </label>
                <Input
                  value={trackingInbound}
                  onChange={(e) => setTrackingInbound(e.target.value)}
                  placeholder="e.g. 1Z999AA10123456784"
                  className="mt-1"
                  maxLength={100}
                />
              </div>

              {/* Fee notice */}
              <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                <span className="font-medium">Verification fee:</span> {formatPrice(500)} will be
                charged from your wallet upon successful minting.
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading || !authenticatorId}>
                  {loading ? "Submitting..." : "Submit for Digitisation"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
