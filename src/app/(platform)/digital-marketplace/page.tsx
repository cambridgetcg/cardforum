"use client";

import { useState, useEffect, useCallback } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DigitalListingCard } from "@/components/digitisation/digital-listing-card";
import { type Condition, type TCG } from "@/types/domain";

interface DigitalListing {
  id: string;
  askPrice: number;
  seller: { id: string; name: string | null };
  token: {
    id: string;
    condition: Condition;
    digitiser: { id: string; name: string | null };
    card: {
      name: string;
      setName: string;
      setCode: string | null;
      number: string | null;
      imageUrl: string | null;
      tcg: string;
    };
  };
}

const TCG_FILTERS: { value: TCG | ""; label: string }[] = [
  { value: "", label: "All TCGs" },
  { value: "POKEMON", label: "Pokemon" },
  { value: "ONEPIECE", label: "One Piece" },
  { value: "YUGIOH", label: "Yu-Gi-Oh!" },
  { value: "MTG", label: "Magic" },
];

const CONDITION_FILTERS: { value: Condition | ""; label: string }[] = [
  { value: "", label: "Any Condition" },
  { value: "NM", label: "NM" },
  { value: "LP", label: "LP" },
  { value: "MP", label: "MP" },
  { value: "HP", label: "HP" },
  { value: "DMG", label: "DMG" },
];

export default function DigitalMarketplacePage() {
  const [listings, setListings] = useState<DigitalListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [tcgFilter, setTcgFilter] = useState<TCG | "">("");
  const [conditionFilter, setConditionFilter] = useState<Condition | "">("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [buyingId, setBuyingId] = useState<string | null>(null);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (tcgFilter) params.set("tcg", tcgFilter);
    if (conditionFilter) params.set("condition", conditionFilter);

    try {
      const res = await fetch(`/api/digital-marketplace?${params}`);
      if (res.ok) {
        const data = await res.json();
        setListings(data);
      }
    } finally {
      setLoading(false);
    }
  }, [tcgFilter, conditionFilter]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((session) => setCurrentUserId(session?.user?.id ?? ""))
      .catch(() => {});
  }, []);

  async function handleBuy(listingId: string) {
    if (buyingId) return;
    setBuyingId(listingId);

    try {
      const res = await fetch(`/api/digital-marketplace/${listingId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        fetchListings();
      } else {
        const data = await res.json();
        alert(typeof data.error === "string" ? data.error : "Purchase failed");
      }
    } finally {
      setBuyingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">Digital Marketplace</h1>
      <p className="mt-1 text-sm text-gray-600">
        Buy and sell digital tokens — instant, global, no shipping
      </p>

      <div className="mt-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex gap-2">
            {TCG_FILTERS.map((f) => (
              <Button
                key={f.value}
                variant={tcgFilter === f.value ? "primary" : "outline"}
                size="sm"
                onClick={() => setTcgFilter(f.value as TCG | "")}
              >
                {f.label}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            {CONDITION_FILTERS.map((f) => (
              <Button
                key={f.value}
                variant={conditionFilter === f.value ? "primary" : "outline"}
                size="sm"
                onClick={() => setConditionFilter(f.value as Condition | "")}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        {loading && <p className="text-sm text-gray-500">Loading listings...</p>}

        {!loading && listings.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
            <p className="text-gray-500">No digital tokens listed for sale.</p>
            <p className="mt-1 text-sm text-gray-400">
              <a href="/digitisation" className="text-indigo-600 hover:text-indigo-700">
                Digitise a card
              </a>{" "}
              and list it here.
            </p>
          </div>
        )}

        {!loading && listings.length > 0 && (
          <>
            <p className="text-sm text-gray-500">
              {listings.length} listing{listings.length !== 1 ? "s" : ""}
            </p>
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {listings.map((listing) => (
                <DigitalListingCard
                  key={listing.id}
                  id={listing.id}
                  askPrice={listing.askPrice}
                  seller={listing.seller}
                  token={listing.token}
                  currentUserId={currentUserId}
                  onBuy={handleBuy}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
