"use client";

import { Input } from "@/components/ui/input";
import {
  SUPPORTED_CURRENCIES,
  CURRENCY_INFO,
  getCurrencyExponent,
  type SupportedCurrency,
} from "@/lib/currency";

interface PriceInputProps {
  value: string;
  onChange: (value: string) => void;
  currency: SupportedCurrency;
  onCurrencyChange: (currency: SupportedCurrency) => void;
  type: "have" | "want";
  error?: string;
}

export function PriceInput({
  value,
  onChange,
  currency,
  onCurrencyChange,
  type,
  error,
}: PriceInputProps) {
  const currencyInfo = CURRENCY_INFO[currency];
  const isZeroDecimal = getCurrencyExponent(currency) === 0;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">
        {type === "have" ? "Your Price" : "Max Price"}
      </label>
      <p className="mt-0.5 text-xs text-gray-500">
        {type === "have" ? "Minimum you want for this card" : "Maximum you'll pay for this card"}
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-gray-500">
            {currencyInfo?.symbol ?? currency}
          </span>
          <Input
            type="number"
            min={isZeroDecimal ? 1 : 0.01}
            step={isZeroDecimal ? 1 : 0.01}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={isZeroDecimal ? "0" : "0.00"}
            className="pl-8"
            error={error}
            required
          />
        </div>
        <select
          value={currency}
          onChange={(e) => onCurrencyChange(e.target.value as SupportedCurrency)}
          className="h-10 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:outline-none"
        >
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
