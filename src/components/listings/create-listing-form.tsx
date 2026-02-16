"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CardSearch } from "./card-search";
import { AIGradingStep } from "./ai-grading-step";
import {
  CONDITION_LABELS,
  TCG_LABELS,
  CARD_LANGUAGE_LABELS,
  CARD_LANGUAGE_VALUES,
  type TCG,
  type Condition,
  type CardLanguage,
} from "@/types/domain";
import { validGradesForCompany } from "@/lib/grading";
import type { AIGradingResult } from "@/types/ximilar";
import {
  SUPPORTED_CURRENCIES,
  CURRENCY_INFO,
  getCurrencyExponent,
  toMinorUnits,
  fromMinorUnits,
  type SupportedCurrency,
} from "@/lib/currency";
import { X, TrendingUp, ChevronDown, ChevronUp, Zap } from "lucide-react";

interface PriceSuggestion {
  suggestedAsk: number | null;
  suggestedBid: number | null;
  market: {
    bestAsk: number | null;
    bestBid: number | null;
    askCount: number;
    bidCount: number;
  };
}

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
  defaultCurrency = "USD",
}: {
  type: "have" | "want";
  onClose: () => void;
  onCreated: () => void;
  defaultCurrency?: SupportedCurrency;
}) {
  const [step, setStep] = useState<"card" | "ai-grading" | "details">("card");
  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(null);
  const [condition, setCondition] = useState<Condition>("NM");
  const [isGraded, setIsGraded] = useState(false);
  const [gradingCompany, setGradingCompany] = useState<"PSA" | "BGS">("PSA");
  const [grade, setGrade] = useState(10);
  const [minGrade, setMinGrade] = useState(7);
  const [certNumber, setCertNumber] = useState("");
  const [language, setLanguage] = useState<CardLanguage>("EN");
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<SupportedCurrency>(defaultCurrency);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // AI grading state
  const [aiResult, setAiResult] = useState<AIGradingResult | null>(null);
  const [aiSuggestedCondition, setAiSuggestedCondition] = useState<Condition | null>(null);

  // Auto-accept
  const [showAutoAccept, setShowAutoAccept] = useState(false);
  const [autoAccept, setAutoAccept] = useState(false);
  const [autoAcceptMaxGap, setAutoAcceptMaxGap] = useState("");
  const [autoAcceptMaxCycleLength, setAutoAcceptMaxCycleLength] = useState("");
  const [autoAcceptRegions, setAutoAcceptRegions] = useState("");

  // Price suggestion
  const [priceSuggestion, setPriceSuggestion] = useState<PriceSuggestion | null>(null);

  // Market price mode
  const [isMarketPrice, setIsMarketPrice] = useState(false);

  // Fetch user's preferred currency from session
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (data?.user?.preferredCurrency) {
          setCurrency(data.user.preferredCurrency as SupportedCurrency);
        }
      })
      .catch(() => {});
  }, []);

  const currencyInfo = CURRENCY_INFO[currency];
  const currencyExp = getCurrencyExponent(currency);
  const isZeroDecimal = currencyExp === 0;

  // Fetch price suggestion when card + condition are selected
  useEffect(() => {
    if (!selectedCard || step !== "details") return;
    setPriceSuggestion(null);
    setIsMarketPrice(false);
    fetch(`/api/marketplace/price-suggestion?cardId=${selectedCard.id}&condition=${condition}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setPriceSuggestion(data);
      })
      .catch(() => {});
  }, [selectedCard, condition, step]);

  function handleCardSelect(card: SelectedCard) {
    setSelectedCard(card);
    setStep(type === "have" ? "ai-grading" : "details");
  }

  function handleAIComplete(result: {
    aiResult: AIGradingResult | null;
    suggestedCondition: Condition;
  }) {
    setAiResult(result.aiResult);
    setAiSuggestedCondition(result.suggestedCondition);
    setCondition(result.suggestedCondition);
    setStep("details");
  }

  function handleAISkip() {
    setAiResult(null);
    setAiSuggestedCondition(null);
    setStep("details");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCard) return;
    setLoading(true);
    setError("");

    const numericPrice = parseFloat(price);
    if (!numericPrice || numericPrice <= 0) {
      setError("Please enter a valid price");
      setLoading(false);
      return;
    }

    // Convert user input to minor units for the selected currency
    const priceInMinorUnits = toMinorUnits(numericPrice, currency);
    if (priceInMinorUnits < 1) {
      setError("Please enter a valid price");
      setLoading(false);
      return;
    }

    const sellerOverrodeAI = aiSuggestedCondition !== null && aiSuggestedCondition !== condition;

    const autoAcceptFields = autoAccept
      ? {
          autoAccept: true,
          ...(autoAcceptMaxGap && { autoAcceptMaxGap: parseInt(autoAcceptMaxGap, 10) }),
          ...(autoAcceptMaxCycleLength && {
            autoAcceptMaxCycleLength: parseInt(autoAcceptMaxCycleLength, 10),
          }),
          ...(autoAcceptRegions.trim() && {
            autoAcceptRegions: autoAcceptRegions
              .split(",")
              .map((r) => r.trim())
              .filter(Boolean),
          }),
        }
      : {};

    let endpoint = "/api/listings";
    let body: Record<string, unknown>;

    if (isGraded) {
      endpoint = "/api/graded-listings";
      body = {
        type,
        cardId: selectedCard.id,
        currency,
        language,
        gradingCompany,
        ...(type === "have"
          ? { grade, certNumber, askPrice: priceInMinorUnits }
          : { minGrade, bidPrice: priceInMinorUnits }),
        ...(notes && { notes }),
        ...autoAcceptFields,
      };
    } else {
      body = {
        type,
        cardId: selectedCard.id,
        currency,
        ...(type === "have"
          ? {
              condition,
              quantity,
              language,
              askPrice: priceInMinorUnits,
              ...(aiResult?.success && aiResult.ccs
                ? {
                    aiGradingResult: aiResult,
                    aiConditionSuggestion: aiResult.suggestedCondition,
                    aiCCSSurface: aiResult.ccs.surface,
                    aiCCSCorners: aiResult.ccs.corners,
                    aiCCSEdges: aiResult.ccs.edges,
                    aiCCSCentering: aiResult.ccs.centering,
                    aiCCSComposite: aiResult.ccs.composite,
                    sellerOverrodeAI,
                  }
                : {}),
            }
          : {
              minCondition: condition,
              maxQuantity: quantity,
              language,
              bidPrice: priceInMinorUnits,
            }),
        ...(notes && { notes }),
        ...autoAcceptFields,
      };
    }

    try {
      const res = await fetch(endpoint, {
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

  // Computed market price values for the toggle
  const marketPriceCents =
    type === "have" ? priceSuggestion?.market.bestBid : priceSuggestion?.market.bestAsk;
  const hasMarketData = marketPriceCents != null;
  const marketLabel = type === "have" ? "Sell at Market" : "Buy at Market";
  const marketDisplayPrice = hasMarketData
    ? `${currencyInfo?.symbol ?? currency}${fromMinorUnits(marketPriceCents, currency).toFixed(isZeroDecimal ? 0 : 2)}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-20">
      <div className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {type === "have" ? "Sell a Card" : "Buy a Card"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
          {step === "card" && <CardSearch onSelect={handleCardSelect} mode="select" />}

          {step === "ai-grading" && (
            <AIGradingStep onComplete={handleAIComplete} onSkip={handleAISkip} />
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

              {/* AI suggestion banner */}
              {aiSuggestedCondition && (
                <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                  <span className="font-medium">AI suggested:</span> {aiSuggestedCondition} (
                  {CONDITION_LABELS[aiSuggestedCondition]})
                  {aiResult?.ccs && (
                    <span className="ml-1 text-xs text-blue-600">
                      — CCS {aiResult.ccs.composite.toFixed(1)} ({aiResult.suggestedSubTier})
                    </span>
                  )}
                  {aiSuggestedCondition !== condition && (
                    <span className="ml-2 text-xs text-amber-700">
                      (you changed to {condition})
                    </span>
                  )}
                </div>
              )}

              {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

              {/* Language selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Card Language</label>
                <div className="mt-2 flex gap-2">
                  {CARD_LANGUAGE_VALUES.map((lang) => (
                    <Button
                      key={lang}
                      type="button"
                      variant={language === lang ? "primary" : "outline"}
                      size="sm"
                      onClick={() => setLanguage(lang)}
                    >
                      {CARD_LANGUAGE_LABELS[lang]}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Condition selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {type === "have" ? "Card Condition" : "Minimum Condition"}
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CONDITIONS.map((c) => (
                    <Button
                      key={c}
                      type="button"
                      variant={!isGraded && condition === c ? "primary" : "outline"}
                      size="sm"
                      onClick={() => {
                        setCondition(c);
                        setIsGraded(false);
                      }}
                    >
                      {c}
                      <span className="ml-1 hidden text-xs opacity-70 sm:inline">
                        {CONDITION_LABELS[c]}
                      </span>
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant={isGraded ? "primary" : "outline"}
                    size="sm"
                    onClick={() => setIsGraded(true)}
                  >
                    Graded
                  </Button>
                </div>
              </div>

              {/* Grading fields (shown when "Graded" selected) */}
              {isGraded && (
                <div className="space-y-4 rounded-lg border border-indigo-100 bg-indigo-50/30 p-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Grading Company
                    </label>
                    <div className="mt-2 flex gap-2">
                      {(["PSA", "BGS"] as const).map((co) => (
                        <Button
                          key={co}
                          type="button"
                          variant={gradingCompany === co ? "primary" : "outline"}
                          size="sm"
                          onClick={() => {
                            setGradingCompany(co);
                            const valid = validGradesForCompany(co);
                            if (!valid.includes(grade)) setGrade(valid[valid.length - 1]);
                            if (!valid.includes(minGrade))
                              setMinGrade(valid[Math.floor(valid.length * 0.6)]);
                          }}
                        >
                          {co}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {type === "have" ? "Grade" : "Minimum Grade"}
                    </label>
                    <select
                      value={type === "have" ? grade : minGrade}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (type === "have") setGrade(val);
                        else setMinGrade(val);
                      }}
                      className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    >
                      {validGradesForCompany(gradingCompany).map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>

                  {type === "have" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Cert Number</label>
                      <Input
                        value={certNumber}
                        onChange={(e) => setCertNumber(e.target.value)}
                        placeholder="e.g. 12345678"
                        className="mt-1 w-48"
                        required
                        pattern="^\d{7,10}$"
                        maxLength={10}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        7-10 digit number on the slab label
                      </p>
                    </div>
                  )}
                </div>
              )}

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

              {/* Pricing Mode Toggle */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Pricing</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={!hasMarketData}
                    onClick={() => {
                      if (!hasMarketData) return;
                      const display = fromMinorUnits(marketPriceCents, currency);
                      setPrice(display.toFixed(isZeroDecimal ? 0 : 2));
                      setIsMarketPrice(true);
                      setAutoAccept(true);
                      setAutoAcceptMaxGap("0");
                      setAutoAcceptMaxCycleLength("4");
                    }}
                    className={`flex flex-col items-start rounded-lg border-2 p-3 text-left transition-colors ${
                      isMarketPrice
                        ? "border-emerald-500 bg-emerald-50"
                        : hasMarketData
                          ? "border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50"
                          : "cursor-not-allowed border-gray-100 bg-gray-50 opacity-60"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                      <Zap
                        className={`h-4 w-4 ${isMarketPrice ? "text-emerald-600" : "text-gray-400"}`}
                      />
                      {marketLabel}
                    </span>
                    <span className="mt-0.5 text-xs text-gray-500">
                      {hasMarketData ? (
                        <>
                          <span className="font-medium text-emerald-700">{marketDisplayPrice}</span>{" "}
                          &middot; Fastest match
                        </>
                      ) : (
                        "No market data"
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMarketPrice(false)}
                    className={`flex flex-col items-start rounded-lg border-2 p-3 text-left transition-colors ${
                      !isMarketPrice
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50"
                    }`}
                  >
                    <span className="text-sm font-semibold text-gray-900">Set Your Price</span>
                    <span className="mt-0.5 text-xs text-gray-500">Enter a custom amount</span>
                  </button>
                </div>
              </div>

              {/* Price display — market mode */}
              {isMarketPrice && (
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-emerald-800">
                      <Zap className="mr-1 inline h-3.5 w-3.5" />
                      {type === "have" ? "Selling" : "Buying"} at {currencyInfo?.symbol ?? currency}
                      {price}
                    </p>
                    <p className="text-xs text-emerald-600">
                      Matching the best {type === "have" ? "bid" : "ask"} price
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMarketPrice(false)}
                    className="text-xs font-medium text-emerald-700 underline hover:text-emerald-900"
                  >
                    Change
                  </button>
                </div>
              )}

              {/* Price + Currency — manual mode */}
              {!isMarketPrice && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {type === "have" ? "Your Price" : "Max Price"}
                  </label>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {type === "have"
                      ? "Minimum value you want for this card"
                      : "Maximum you'll pay for this card"}
                  </p>

                  {/* Price suggestion */}
                  {priceSuggestion &&
                    (priceSuggestion.suggestedAsk ?? priceSuggestion.suggestedBid) && (
                      <div className="mt-1.5 flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800">
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span>
                          Suggested:{" "}
                          <button
                            type="button"
                            className="font-semibold underline decoration-dotted hover:text-emerald-900"
                            onClick={() => {
                              const cents =
                                type === "have"
                                  ? priceSuggestion.suggestedAsk
                                  : priceSuggestion.suggestedBid;
                              if (cents != null) {
                                setPrice(fromMinorUnits(cents, currency).toString());
                              }
                            }}
                          >
                            {currencyInfo?.symbol ?? currency}
                            {fromMinorUnits(
                              (type === "have"
                                ? priceSuggestion.suggestedAsk
                                : priceSuggestion.suggestedBid) ?? 0,
                              currency,
                            ).toFixed(isZeroDecimal ? 0 : 2)}
                          </button>
                        </span>
                        {priceSuggestion.market.askCount > 0 && (
                          <span className="text-emerald-600">
                            ({priceSuggestion.market.askCount} ask
                            {priceSuggestion.market.askCount !== 1 ? "s" : ""},{" "}
                            {priceSuggestion.market.bidCount} bid
                            {priceSuggestion.market.bidCount !== 1 ? "s" : ""})
                          </span>
                        )}
                      </div>
                    )}
                  <div className="mt-1 flex items-center gap-2">
                    <div className="relative">
                      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-gray-500">
                        {currencyInfo?.symbol ?? currency}
                      </span>
                      <Input
                        type="number"
                        min={isZeroDecimal ? 1 : 0.01}
                        step={isZeroDecimal ? 1 : 0.01}
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder={isZeroDecimal ? "0" : "0.00"}
                        className="w-36 pl-8"
                        required
                      />
                    </div>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as SupportedCurrency)}
                      className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-700 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    >
                      {SUPPORTED_CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c} {CURRENCY_INFO[c]?.flag ?? ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Notes (optional)</label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any specifics about this listing..."
                  className="mt-1"
                  maxLength={500}
                />
              </div>

              {/* Auto-Accept — market mode: compact read-only summary */}
              {isMarketPrice ? (
                <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <span className="font-medium">Auto-accept enabled</span>
                  <span className="ml-1 text-emerald-600">
                    &mdash; no slippage, max 4-way cycle
                  </span>
                </div>
              ) : (
                /* Auto-Accept — manual mode: full accordion */
                <div className="rounded-lg border border-gray-200">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    onClick={() => setShowAutoAccept(!showAutoAccept)}
                  >
                    <span>Auto-Accept Settings</span>
                    {showAutoAccept ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                  {showAutoAccept && (
                    <div className="space-y-4 border-t border-gray-100 px-4 py-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={autoAccept}
                          onChange={(e) => setAutoAccept(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                        />
                        <span className="text-sm text-gray-700">Auto-accept matching trades</span>
                      </label>
                      <p className="text-xs text-gray-500">
                        When enabled, the matching engine will automatically accept trades that meet
                        your constraints without waiting for manual approval.
                      </p>
                      {autoAccept && (
                        <div className="space-y-3 pl-6">
                          <div>
                            <label className="block text-xs font-medium text-gray-600">
                              Max price gap (cents)
                            </label>
                            <Input
                              type="number"
                              min={0}
                              value={autoAcceptMaxGap}
                              onChange={(e) => setAutoAcceptMaxGap(e.target.value)}
                              placeholder="No limit"
                              className="mt-1 w-32"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600">
                              Max cycle length
                            </label>
                            <Input
                              type="number"
                              min={2}
                              max={6}
                              value={autoAcceptMaxCycleLength}
                              onChange={(e) => setAutoAcceptMaxCycleLength(e.target.value)}
                              placeholder="Any (2-6)"
                              className="mt-1 w-32"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600">
                              Allowed regions (comma-separated)
                            </label>
                            <Input
                              value={autoAcceptRegions}
                              onChange={(e) => setAutoAcceptRegions(e.target.value)}
                              placeholder="Any region"
                              className="mt-1"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

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
