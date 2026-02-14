"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ListingCard } from "@/components/listings/listing-card";
import { CreateListingForm } from "@/components/listings/create-listing-form";
import type { TCG, Condition } from "@/types/domain";

interface CardData {
  name: string;
  setName: string;
  setCode: string | null;
  number: string | null;
  tcg: TCG;
  rarity: string | null;
}

interface HaveListing {
  id: string;
  condition: Condition;
  quantity: number;
  language: string;
  notes: string | null;
  createdAt: string;
  card: CardData;
}

interface WantListing {
  id: string;
  minCondition: Condition;
  maxQuantity: number;
  notes: string | null;
  createdAt: string;
  card: CardData;
}

export default function ListingsPage() {
  const [haveListings, setHaveListings] = useState<HaveListing[]>([]);
  const [wantListings, setWantListings] = useState<WantListing[]>([]);
  const [showForm, setShowForm] = useState<"have" | "want" | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchListings = useCallback(async () => {
    try {
      const res = await fetch("/api/listings");
      if (res.ok) {
        const data = await res.json();
        setHaveListings(data.have);
        setWantListings(data.want);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  async function handleDelete(id: string, type: "have" | "want") {
    await fetch(`/api/listings?id=${id}&type=${type}`, { method: "DELETE" });
    fetchListings();
  }

  function handleCreated() {
    setShowForm(null);
    fetchListings();
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-gray-500">Loading listings...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Listings</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your have and want listings
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowForm("want")}>
            + Want
          </Button>
          <Button onClick={() => setShowForm("have")}>
            + Have
          </Button>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Have Listings */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Cards I Have ({haveListings.length})
          </h2>
          {haveListings.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
              <p className="text-gray-500">No have listings yet.</p>
              <button
                onClick={() => setShowForm("have")}
                className="mt-2 text-sm text-indigo-600 hover:text-indigo-500"
              >
                Add a card you want to trade
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {haveListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  id={listing.id}
                  type="have"
                  card={listing.card}
                  condition={listing.condition}
                  quantity={listing.quantity}
                  notes={listing.notes}
                  createdAt={listing.createdAt}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>

        {/* Want Listings */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Cards I Want ({wantListings.length})
          </h2>
          {wantListings.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
              <p className="text-gray-500">No want listings yet.</p>
              <button
                onClick={() => setShowForm("want")}
                className="mt-2 text-sm text-indigo-600 hover:text-indigo-500"
              >
                Add a card you&apos;re looking for
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {wantListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  id={listing.id}
                  type="want"
                  card={listing.card}
                  condition={listing.minCondition}
                  quantity={listing.maxQuantity}
                  notes={listing.notes}
                  createdAt={listing.createdAt}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Listing Modal */}
      {showForm && (
        <CreateListingForm
          type={showForm}
          onClose={() => setShowForm(null)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
