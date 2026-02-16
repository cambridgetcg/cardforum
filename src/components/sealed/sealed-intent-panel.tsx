"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SealedProductSearch } from "./sealed-product-search";
import { ArrowLeft } from "lucide-react";
import {
  TCG_LABELS,
  TCG_BADGE_COLORS,
  SEALED_CONDITION_LABELS,
  SEALED_CONDITION_VALUES,
  SEALED_PRODUCT_TYPE_LABELS,
  type TCG,
  type SealedCondition,
  type SealedProductType,
} from "@/types/domain";
import {
  toMinorUnits,
  getCurrencyExponent,
  CURRENCY_INFO,
  type SupportedCurrency,
} from "@/lib/currency";

interface SealedProductData {
  id: string;
  tcg: TCG;
  name: string;
  setName: string;
  setCode: string | null;
  productType: SealedProductType;
  imageUrl: string | null;
  priceUsd: number | null;
}

interface SealedIntentPanelProps {
  open: boolean;
  product: SealedProductData | null;
  type: "have" | "want";
  onClose: () => void;
  onCreated: () => void;
  defaultCurrency?: SupportedCurrency;
}

export function SealedIntentPanel({
  open,
  product: initialProduct,
  type,
  onClose,
  onCreated,
  defaultCurrency = "USD",
}: SealedIntentPanelProps) {
  const [product, setProduct] = useState<SealedProductData | null>(initialProduct);
  const [condition, setCondition] = useState<SealedCondition>("FACTORY_SEALED");
  const [priceStr, setPriceStr] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currency] = useState<SupportedCurrency>(defaultCurrency);

  const currencyInfo = CURRENCY_INFO[currency];
  const symbol = currencyInfo?.symbol ?? "$";

  const handleSubmit = async () => {
    if (!product) return;

    const priceNum = parseFloat(priceStr);
    if (isNaN(priceNum) || priceNum <= 0) {
      setError("Enter a valid price");
      return;
    }

    const exp = getCurrencyExponent(currency);
    const minorUnits = toMinorUnits(priceNum, currency);

    setSubmitting(true);
    setError(null);

    try {
      const body =
        type === "have"
          ? {
              type: "have",
              sealedProductId: product.id,
              condition,
              askPrice: minorUnits,
              currency,
              notes: notes || undefined,
            }
          : {
              type: "want",
              sealedProductId: product.id,
              minCondition: condition,
              bidPrice: minorUnits,
              currency,
              notes: notes || undefined,
            };

      const res = await fetch("/api/sealed-listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ? JSON.stringify(data.error) : "Failed to create listing");
      }

      onCreated();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setProduct(initialProduct);
    setCondition("FACTORY_SEALED");
    setPriceStr("");
    setNotes("");
    setError(null);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title={type === "have" ? "I Have (Sell) — Sealed" : "I Want (Buy) — Sealed"}
    >
      <div className="space-y-4">
        {/* Step 1: Product selection */}
        {!product ? (
          <SealedProductSearch onSelect={setProduct} />
        ) : (
          <div className="space-y-4">
            {/* Selected product header */}
            <button
              onClick={() => setProduct(null)}
              className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Change product
            </button>

            <div className="flex items-center gap-3 rounded-md border p-3">
              {product.imageUrl && (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="h-16 w-16 rounded object-cover"
                />
              )}
              <div>
                <p className="font-medium">{product.name}</p>
                <div className="flex items-center gap-1.5">
                  <Badge variant={TCG_BADGE_COLORS[product.tcg]} className="text-[10px]">
                    {TCG_LABELS[product.tcg]}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    {SEALED_PRODUCT_TYPE_LABELS[product.productType]}
                  </span>
                </div>
              </div>
            </div>

            {/* Step 2: Condition */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {type === "have" ? "Condition" : "Minimum Condition"}
              </label>
              <div className="flex gap-2">
                {SEALED_CONDITION_VALUES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCondition(c)}
                    className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                      condition === c
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:bg-accent"
                    }`}
                  >
                    {SEALED_CONDITION_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: Price */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {type === "have" ? "Ask Price" : "Bid Price"}
              </label>
              <div className="relative">
                <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2">
                  {symbol}
                </span>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={priceStr}
                  onChange={(e) => setPriceStr(e.target.value)}
                  className="pl-8"
                  step={getCurrencyExponent(currency) === 0 ? "1" : "0.01"}
                  min="0"
                />
              </div>
              {product.priceUsd != null && (
                <p className="text-muted-foreground mt-1 text-xs">
                  Market price: ~${product.priceUsd.toFixed(2)} USD
                </p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">Notes (optional)</label>
              <Input
                placeholder="Any details about the product..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
              />
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <Button onClick={handleSubmit} disabled={submitting || !priceStr} className="w-full">
              {submitting ? "Creating..." : type === "have" ? "List for Sale" : "Place Bid"}
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
