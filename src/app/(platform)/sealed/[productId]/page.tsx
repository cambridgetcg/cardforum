"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SealedIntentPanel } from "@/components/sealed/sealed-intent-panel";
import {
  formatPrice,
  TCG_LABELS,
  TCG_BADGE_COLORS,
  SEALED_PRODUCT_TYPE_LABELS,
  SEALED_CONDITION_LABELS,
  type TCG,
  type SealedProductType,
  type SealedCondition,
} from "@/types/domain";

interface SealedProductDetail {
  id: string;
  tcg: TCG;
  name: string;
  setName: string;
  setCode: string | null;
  productType: SealedProductType;
  imageUrl: string | null;
  priceUsd: number | null;
  priceUsdLow: number | null;
  priceUsdMid: number | null;
  set: { id: string; code: string; name: string } | null;
}

interface SealedAskLevel {
  price: number;
  totalQty: number;
  listings: number;
  conditions: string[];
}

interface SealedBidLevel {
  price: number;
  totalQty: number;
  listings: number;
  minConditions: string[];
}

interface SealedOrderBook {
  asks: SealedAskLevel[];
  bids: SealedBidLevel[];
  summary: {
    bestAsk: number | null;
    bestBid: number | null;
    spread: number | null;
    spreadPct: number | null;
    midpoint: number | null;
    totalAsks: number;
    totalBids: number;
  };
}

export default function SealedProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const [product, setProduct] = useState<SealedProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intentType, setIntentType] = useState<"have" | "want" | null>(null);
  const [orderBook, setOrderBook] = useState<SealedOrderBook | null>(null);

  useEffect(() => {
    if (!productId) return;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
    Promise.all([
      fetch(`/api/sealed-products/${productId}`).then((res) => {
        if (!res.ok) throw new Error("Product not found");
        return res.json();
      }),
      fetch(`/api/orderbook/sealed?productId=${productId}`)
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
    ])
      .then(([prod, ob]: [SealedProductDetail, SealedOrderBook | null]) => {
        setProduct(prod);
        setOrderBook(ob);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [productId]);

  function refetchOrderBook() {
    fetch(`/api/orderbook/sealed?productId=${productId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((ob: SealedOrderBook | null) => setOrderBook(ob))
      .catch(() => {});
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-muted-foreground text-sm">Loading product...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-destructive text-sm">{error ?? "Product not found"}</p>
        <Link href="/sealed" className="text-primary text-sm hover:underline">
          Back to sealed marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Back link */}
      <Link
        href="/sealed"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Sealed Marketplace
      </Link>

      {/* Product Header */}
      <div className="mb-8 flex flex-col gap-6 sm:flex-row">
        <div className="shrink-0">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-48 w-48 rounded-lg object-cover"
            />
          ) : (
            <div className="bg-muted flex h-48 w-48 items-center justify-center rounded-lg">
              <Package className="text-muted-foreground/50 h-16 w-16" />
            </div>
          )}
        </div>

        <div className="flex-1">
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={TCG_BADGE_COLORS[product.tcg]}>{TCG_LABELS[product.tcg]}</Badge>
            <Badge variant="default">{SEALED_PRODUCT_TYPE_LABELS[product.productType]}</Badge>
            {product.setCode && <Badge variant="default">{product.setCode}</Badge>}
          </div>
          {product.setName && (
            <p className="text-muted-foreground mt-2 text-sm">{product.setName}</p>
          )}

          {/* Price info */}
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div>
              <p className="text-muted-foreground text-xs">Market Price</p>
              <p className="text-lg font-semibold">
                {product.priceUsd != null ? `$${product.priceUsd.toFixed(2)}` : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Low</p>
              <p className="text-lg font-semibold">
                {product.priceUsdLow != null ? `$${product.priceUsdLow.toFixed(2)}` : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Mid</p>
              <p className="text-lg font-semibold">
                {product.priceUsdMid != null ? `$${product.priceUsdMid.toFixed(2)}` : "—"}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex gap-3">
            <Button onClick={() => setIntentType("have")}>I Have This — Sell</Button>
            <Button variant="outline" onClick={() => setIntentType("want")}>
              I Want This — Buy
            </Button>
          </div>
        </div>
      </div>

      {/* Order Book Summary */}
      {orderBook && (
        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border px-5 py-3.5">
          <SummaryStat
            label="Best Bid"
            value={
              orderBook.summary.bestBid != null ? formatPrice(orderBook.summary.bestBid) : "--"
            }
            color="text-emerald-600"
          />
          <SummaryStat
            label="Best Ask"
            value={
              orderBook.summary.bestAsk != null ? formatPrice(orderBook.summary.bestAsk) : "--"
            }
            color="text-amber-600"
          />
          <SummaryStat
            label="Spread"
            value={orderBook.summary.spread != null ? formatPrice(orderBook.summary.spread) : "--"}
            sub={
              orderBook.summary.spreadPct != null ? `${orderBook.summary.spreadPct}%` : undefined
            }
            color="text-foreground"
          />
          <SummaryStat
            label="Midpoint"
            value={
              orderBook.summary.midpoint != null ? formatPrice(orderBook.summary.midpoint) : "--"
            }
            color="text-primary"
          />
          <SummaryStat
            label="Total Bids"
            value={String(orderBook.summary.totalBids)}
            color="text-emerald-600"
          />
          <SummaryStat
            label="Total Asks"
            value={String(orderBook.summary.totalAsks)}
            color="text-amber-600"
          />
        </div>
      )}

      {/* Order Book Depth Table */}
      {orderBook && (orderBook.asks.length > 0 || orderBook.bids.length > 0) && (
        <div className="mb-6 overflow-hidden rounded-xl border">
          <h2 className="border-b px-5 py-3 text-sm font-semibold">Order Book Depth</h2>
          <SealedDepthTable asks={orderBook.asks} bids={orderBook.bids} />
        </div>
      )}

      {/* Intent Panel */}
      <SealedIntentPanel
        open={intentType !== null}
        product={
          product
            ? {
                id: product.id,
                tcg: product.tcg,
                name: product.name,
                setName: product.setName,
                setCode: product.setCode,
                productType: product.productType,
                imageUrl: product.imageUrl,
                priceUsd: product.priceUsd,
              }
            : null
        }
        type={intentType ?? "have"}
        onClose={() => setIntentType(null)}
        onCreated={() => {
          setIntentType(null);
          refetchOrderBook();
        }}
      />
    </div>
  );
}

function SummaryStat({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-muted-foreground text-[10px] tracking-wide uppercase">{label}</span>
      <span className={`text-lg font-bold tabular-nums ${color}`}>
        {value}
        {sub && <span className="text-muted-foreground ml-1 text-xs font-normal">({sub})</span>}
      </span>
    </div>
  );
}

function SealedDepthTable({ asks, bids }: { asks: SealedAskLevel[]; bids: SealedBidLevel[] }) {
  const maxRows = Math.max(asks.length, bids.length, 1);
  const allQtys = [...asks.map((a) => a.totalQty), ...bids.map((b) => b.totalQty)];
  const maxQty = Math.max(...allQtys, 1);

  return (
    <div className="grid grid-cols-2 divide-x">
      {/* Bids (left) */}
      <div>
        <div className="text-muted-foreground grid grid-cols-[1fr_auto_auto] gap-x-3 border-b px-4 py-2 text-xs font-medium">
          <span>Condition</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Bid</span>
        </div>
        {Array.from({ length: maxRows }).map((_, i) => {
          const bid = bids[i];
          if (!bid) return <div key={`bid-${i}`} className="h-9" />;
          const depthPct = (bid.totalQty / maxQty) * 100;
          return (
            <div
              key={`bid-${i}`}
              className="relative grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-4 py-1.5"
            >
              <div
                className="absolute inset-y-0 right-0 bg-emerald-50"
                style={{ width: `${depthPct}%` }}
              />
              <span className="text-muted-foreground relative z-10 text-xs">
                {bid.minConditions
                  .map((c) => SEALED_CONDITION_LABELS[c as SealedCondition] ?? c)
                  .join(", ")}
              </span>
              <span className="relative z-10 text-right text-sm tabular-nums">{bid.totalQty}</span>
              <span className="relative z-10 text-right text-sm font-semibold text-emerald-600 tabular-nums">
                {formatPrice(bid.price)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Asks (right) */}
      <div>
        <div className="text-muted-foreground grid grid-cols-[auto_auto_1fr] gap-x-3 border-b px-4 py-2 text-xs font-medium">
          <span>Ask</span>
          <span>Qty</span>
          <span className="text-right">Condition</span>
        </div>
        {Array.from({ length: maxRows }).map((_, i) => {
          const ask = asks[i];
          if (!ask) return <div key={`ask-${i}`} className="h-9" />;
          const depthPct = (ask.totalQty / maxQty) * 100;
          return (
            <div
              key={`ask-${i}`}
              className="relative grid grid-cols-[auto_auto_1fr] items-center gap-x-3 px-4 py-1.5"
            >
              <div
                className="absolute inset-y-0 left-0 bg-amber-50"
                style={{ width: `${depthPct}%` }}
              />
              <span className="relative z-10 text-sm font-semibold text-amber-600 tabular-nums">
                {formatPrice(ask.price)}
              </span>
              <span className="relative z-10 text-sm tabular-nums">{ask.totalQty}</span>
              <span className="text-muted-foreground relative z-10 text-right text-xs">
                {ask.conditions
                  .map((c) => SEALED_CONDITION_LABELS[c as SealedCondition] ?? c)
                  .join(", ")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
