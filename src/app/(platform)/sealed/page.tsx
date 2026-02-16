"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SealedListingFab } from "@/components/sealed/sealed-listing-fab";
import { Search, Package } from "lucide-react";
import {
  formatPrice,
  TCG_LABELS,
  TCG_BADGE_COLORS,
  SEALED_PRODUCT_TYPE_LABELS,
  type TCG,
  type SealedProductType,
} from "@/types/domain";

interface SealedMarketItem {
  id: string;
  tcg: TCG;
  name: string;
  setName: string;
  setCode: string | null;
  productType: SealedProductType;
  imageUrl: string | null;
  priceUsd: number | null;
  set: { id: string; code: string; name: string } | null;
  market: {
    bestAskUsd: number | null;
    bestBidUsd: number | null;
    spreadUsd: number | null;
    spreadPct: number | null;
    askCount: number;
    bidCount: number;
    bestAsk: number | null;
    bestBid: number | null;
  };
}

const PRODUCT_TYPE_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All Types" },
  { value: "BOOSTER_BOX", label: "Booster Box" },
  { value: "BOOSTER_PACK", label: "Booster Pack" },
  { value: "STARTER_DECK", label: "Starter Deck" },
  { value: "BUNDLE", label: "Bundle" },
  { value: "COLLECTION_BOX", label: "Collection Box" },
  { value: "PREMIUM_PACK", label: "Premium Pack" },
  { value: "OTHER", label: "Other" },
];

export default function SealedMarketplacePage() {
  const [products, setProducts] = useState<SealedMarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    params.set("tcg", "ONEPIECE");
    if (typeFilter) params.set("type", typeFilter);
    params.set("page", String(page));
    params.set("limit", "20");

    try {
      const res = await fetch(`/api/sealed-marketplace?${params}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products ?? []);
        setTotalPages(data.totalPages ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [query, typeFilter, page]);

  useEffect(() => {
    const timer = setTimeout(() => fetchProducts(), 300);
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Sealed Product Marketplace</h1>
        <p className="text-muted-foreground text-sm">
          Trade sealed booster boxes, packs, and starter decks
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search sealed products..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            className="pl-10"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="bg-background rounded-md border px-3 py-2 text-sm"
        >
          {PRODUCT_TYPE_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {/* Product Grid */}
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <Package className="text-muted-foreground/50 h-12 w-12" />
          <p className="text-muted-foreground">No sealed products with active listings</p>
          <p className="text-muted-foreground text-sm">
            Be the first to list a sealed product for trade
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/sealed/${product.id}`}
              className="group hover:bg-accent/50 rounded-lg border p-4 transition-colors"
            >
              <div className="mb-3 flex items-start gap-3">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-20 w-20 rounded object-cover"
                  />
                ) : (
                  <div className="bg-muted flex h-20 w-20 items-center justify-center rounded">
                    <Package className="text-muted-foreground/50 h-8 w-8" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="group-hover:text-primary truncate text-sm font-medium">
                    {product.name}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <Badge variant={TCG_BADGE_COLORS[product.tcg]} className="text-[10px]">
                      {TCG_LABELS[product.tcg]}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {SEALED_PRODUCT_TYPE_LABELS[product.productType]}
                    </span>
                  </div>
                  {product.setCode && (
                    <p className="text-muted-foreground mt-0.5 text-xs">{product.setName}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Best Ask</span>
                  <p className="font-medium text-red-600">
                    {product.market.bestAskUsd != null
                      ? formatPrice(product.market.bestAskUsd)
                      : "—"}
                  </p>
                  <span className="text-muted-foreground">{product.market.askCount} listings</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Best Bid</span>
                  <p className="font-medium text-green-600">
                    {product.market.bestBidUsd != null
                      ? formatPrice(product.market.bestBidUsd)
                      : "—"}
                  </p>
                  <span className="text-muted-foreground">{product.market.bidCount} listings</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-muted-foreground text-sm">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <SealedListingFab onCreated={fetchProducts} />
    </div>
  );
}
