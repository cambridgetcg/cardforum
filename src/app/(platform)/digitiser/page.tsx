"use client";

import { useEffect, useState, useCallback } from "react";
import { DigitiserStats } from "@/components/digitisation/digitiser-stats";
import { DigitalTokenCard } from "@/components/digitisation/digital-token-card";
import { Badge } from "@/components/ui/badge";
import { CONDITION_LABELS, formatPrice, type Condition, type DigitalTokenStatus } from "@/types/domain";
import { formatRelativeTime } from "@/lib/utils";

interface Stats {
  totalTokensDigitised: number;
  activeTokens: number;
  lifetimeRoyaltyCents: number;
  last30dRoyaltyCents: number;
  totalTrades: number;
}

interface DigitisedToken {
  id: string;
  status: DigitalTokenStatus;
  condition: Condition;
  mintedAt: string;
  lastTradedAt: string | null;
  card: {
    name: string;
    setName: string;
    setCode: string | null;
    number: string | null;
    imageUrl: string | null;
    tcg: string;
  };
  currentOwner: { id: string; name: string | null };
  transfers: {
    id: string;
    priceCents: number;
    royaltyCents: number;
    transferredAt: string;
  }[];
}

export default function DigitiserPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [tokens, setTokens] = useState<DigitisedToken[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, tokensRes] = await Promise.all([
        fetch("/api/digitiser"),
        fetch("/api/digitiser?view=tokens"),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (tokensRes.ok) setTokens(await tokensRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-gray-500">Loading digitiser dashboard...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">Digitiser Dashboard</h1>
      <p className="mt-1 text-sm text-gray-600">
        Track your digitised tokens and royalty earnings
      </p>

      {/* Stats */}
      {stats && (
        <div className="mt-6">
          <DigitiserStats {...stats} />
        </div>
      )}

      {/* Tokens with trade history */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Your Digitised Tokens</h2>
        {tokens.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
            <p className="text-gray-500">You haven&apos;t digitised any cards yet.</p>
            <p className="mt-1 text-sm text-gray-400">
              <a href="/digitisation" className="text-indigo-600 hover:text-indigo-700">
                Digitise your first card
              </a>{" "}
              to start earning royalties.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {tokens.map((token) => (
              <div
                key={token.id}
                className="rounded-xl border border-gray-200 bg-white p-4"
              >
                <div className="flex items-start gap-4">
                  {/* Card thumbnail */}
                  <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {token.card.imageUrl ? (
                      <img
                        src={token.card.imageUrl}
                        alt={token.card.name}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-gray-300">
                        ?
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{token.card.name}</h3>
                      <Badge variant="default">
                        {token.condition} — {CONDITION_LABELS[token.condition]}
                      </Badge>
                      <Badge variant={token.status === "ACTIVE" || token.status === "LISTED" ? "success" : "default"}>
                        {token.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      {token.card.setName}
                      {token.card.setCode && ` (${token.card.setCode})`}
                    </p>
                    <p className="text-xs text-gray-400">
                      Minted {formatRelativeTime(new Date(token.mintedAt))}
                      {" — "}Current owner: {token.currentOwner.name ?? "Unknown"}
                    </p>

                    {/* Trade history */}
                    {token.transfers.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-medium text-gray-500">
                          Recent trades ({token.transfers.length})
                        </p>
                        {token.transfers.map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center justify-between text-xs text-gray-500"
                          >
                            <span>
                              Sold for {formatPrice(t.priceCents)}
                            </span>
                            <span className="font-medium text-green-600">
                              +{formatPrice(t.royaltyCents)} royalty
                            </span>
                            <span className="text-gray-400">
                              {formatRelativeTime(new Date(t.transferredAt))}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
