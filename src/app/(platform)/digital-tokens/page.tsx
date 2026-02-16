"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { DigitalTokenCard } from "@/components/digitisation/digital-token-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatPrice, type Condition, type DigitalTokenStatus } from "@/types/domain";
import { Search } from "lucide-react";

interface Token {
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
  digitiser: { id: string; name: string | null };
}

export default function DigitalTokensPage() {
  const { data: session } = useSession();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [listingTokenId, setListingTokenId] = useState<string | null>(null);
  const [askPrice, setAskPrice] = useState("");
  const [listingError, setListingError] = useState("");

  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch("/api/digital-tokens");
      if (res.ok) {
        const data = await res.json();
        setTokens(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  async function handleList(tokenId: string) {
    setListingTokenId(tokenId);
    setAskPrice("");
    setListingError("");
  }

  async function submitListing() {
    if (!listingTokenId) return;
    const priceInCents = Math.round(parseFloat(askPrice) * 100);
    if (!priceInCents || priceInCents < 1) {
      setListingError("Enter a valid price");
      return;
    }

    const res = await fetch("/api/digital-marketplace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenId: listingTokenId, askPrice: priceInCents }),
    });

    if (res.ok) {
      setListingTokenId(null);
      fetchTokens();
    } else {
      const data = await res.json();
      setListingError(typeof data.error === "string" ? data.error : "Failed to list");
    }
  }

  async function handleRedeem(tokenId: string) {
    // Navigate to redemption page (user picks country there)
    window.location.href = `/redemptions?tokenId=${tokenId}`;
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-gray-500">Loading your tokens...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">My Digital Tokens</h1>
      <p className="mt-1 text-sm text-gray-600">
        Tokens you own — list for sale or redeem for a physical card
      </p>

      {/* Listing modal */}
      {listingTokenId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">List Token for Sale</h3>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Ask Price ($)</label>
              <div className="mt-1 flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-gray-400">
                    $
                  </span>
                  <Input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={askPrice}
                    onChange={(e) => setAskPrice(e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                  />
                </div>
              </div>
              {listingError && <p className="mt-2 text-sm text-red-600">{listingError}</p>}
              <p className="mt-2 text-xs text-gray-400">Platform fee: 5% — Digitiser royalty: 2%</p>
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setListingTokenId(null)}>
                Cancel
              </Button>
              <Button onClick={submitListing}>List for Sale</Button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6">
        {tokens.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
            <p className="text-gray-500">You don&apos;t own any digital tokens yet.</p>
            <p className="mt-1 text-sm text-gray-400">
              <a href="/digitisation" className="text-indigo-600 hover:text-indigo-700">
                Digitise a card
              </a>{" "}
              or{" "}
              <a href="/digital-marketplace" className="text-indigo-600 hover:text-indigo-700">
                buy one
              </a>{" "}
              on the marketplace.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {tokens.map((token) => (
              <DigitalTokenCard
                key={token.id}
                id={token.id}
                status={token.status}
                card={token.card}
                condition={token.condition}
                digitiser={token.digitiser}
                isOwner={true}
                mintedAt={token.mintedAt}
                lastTradedAt={token.lastTradedAt}
                onList={handleList}
                onRedeem={handleRedeem}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
