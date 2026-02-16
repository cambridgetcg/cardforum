"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import {
  TCG_LABELS,
  TCG_BADGE_COLORS,
  SEALED_PRODUCT_TYPE_LABELS,
  type TCG,
  type SealedProductType,
} from "@/types/domain";

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

interface SealedProductSearchProps {
  onSelect: (product: SealedProductData) => void;
  tcgFilter?: string;
}

export function SealedProductSearch({ onSelect, tcgFilter }: SealedProductSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SealedProductData[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(
    async (q: string) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (tcgFilter) params.set("tcg", tcgFilter);
      params.set("limit", "20");

      try {
        const res = await fetch(`/api/sealed-products?${params}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.products ?? []);
        }
      } finally {
        setLoading(false);
      }
    },
    [tcgFilter],
  );

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder="Search sealed products..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading && <p className="text-muted-foreground text-sm">Searching...</p>}

      <div className="max-h-80 space-y-1 overflow-y-auto">
        {results.map((product) => (
          <button
            key={product.id}
            onClick={() => onSelect(product)}
            className="hover:bg-accent flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors"
          >
            {product.imageUrl && (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="h-12 w-12 rounded object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{product.name}</p>
              <div className="flex items-center gap-1.5">
                <Badge variant={TCG_BADGE_COLORS[product.tcg]} className="text-[10px]">
                  {TCG_LABELS[product.tcg]}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  {SEALED_PRODUCT_TYPE_LABELS[product.productType]}
                </span>
                {product.setCode && (
                  <span className="text-muted-foreground text-xs">{product.setCode}</span>
                )}
              </div>
            </div>
            {product.priceUsd != null && (
              <span className="text-muted-foreground text-xs">~${product.priceUsd.toFixed(2)}</span>
            )}
          </button>
        ))}
        {!loading && results.length === 0 && query && (
          <p className="text-muted-foreground py-4 text-center text-sm">No sealed products found</p>
        )}
      </div>
    </div>
  );
}
