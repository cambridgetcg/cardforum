"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ListingCard } from "@/components/listings/listing-card";
import { GradedListingCard } from "@/components/listings/graded-listing-card";
import { IntentPanel } from "@/components/listings/intent-panel";
import { CreateGradedListingForm } from "@/components/listings/create-graded-listing-form";
import type { TCG, Condition, GradingCompany } from "@/types/domain";

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
  askPrice: number;
  currency: string;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  card: CardData;
  aiCCSComposite: number | null;
  sellerOverrodeAI: boolean;
}

interface WantListing {
  id: string;
  minCondition: Condition;
  maxQuantity: number;
  bidPrice: number;
  currency: string;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  card: CardData;
}

interface GradedHaveListing {
  id: string;
  gradingCompany: GradingCompany;
  grade: number;
  certNumber: string;
  language: string;
  askPrice: number;
  notes: string | null;
  createdAt: string;
  card: CardData;
}

interface GradedWantListing {
  id: string;
  gradingCompany: GradingCompany | null;
  minGrade: number;
  maxGrade: number | null;
  bidPrice: number;
  notes: string | null;
  createdAt: string;
  card: CardData;
}

type Tab = "raw" | "graded";
type FormMode = "have" | "want" | "graded-have" | "graded-want" | null;
type ViewFilter = "all" | "active" | "paused";

export default function ListingsPage() {
  const [tab, setTab] = useState<Tab>("raw");
  const [haveListings, setHaveListings] = useState<HaveListing[]>([]);
  const [wantListings, setWantListings] = useState<WantListing[]>([]);
  const [gradedHaveListings, setGradedHaveListings] = useState<GradedHaveListing[]>([]);
  const [gradedWantListings, setGradedWantListings] = useState<GradedWantListing[]>([]);
  const [showForm, setShowForm] = useState<FormMode>(null);
  const [loading, setLoading] = useState(true);
  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");

  const fetchListings = useCallback(async () => {
    try {
      const [rawRes, gradedRes] = await Promise.all([
        fetch("/api/listings"),
        fetch("/api/graded-listings"),
      ]);
      if (rawRes.ok) {
        const data = await rawRes.json();
        setHaveListings(data.have);
        setWantListings(data.want);
      }
      if (gradedRes.ok) {
        const data = await gradedRes.json();
        setGradedHaveListings(data.have);
        setGradedWantListings(data.want);
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

  async function handleUpdate(id: string, type: "have" | "want", data: Record<string, unknown>) {
    const res = await fetch(`/api/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...data }),
    });
    if (res.ok) {
      fetchListings();
    }
  }

  async function handleGradedDelete(id: string, type: "have" | "want") {
    await fetch(`/api/graded-listings?id=${id}&type=${type}`, { method: "DELETE" });
    fetchListings();
  }

  function handleCreated() {
    setShowForm(null);
    fetchListings();
  }

  // Filter listings
  const filteredHave = haveListings.filter((l) =>
    viewFilter === "all" ? true : viewFilter === "active" ? l.isActive : !l.isActive,
  );
  const filteredWant = wantListings.filter((l) =>
    viewFilter === "all" ? true : viewFilter === "active" ? l.isActive : !l.isActive,
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-gray-500">Loading listings...</p>
      </div>
    );
  }

  const rawCount = haveListings.length + wantListings.length;
  const gradedCount = gradedHaveListings.length + gradedWantListings.length;
  const pausedCount =
    haveListings.filter((l) => !l.isActive).length + wantListings.filter((l) => !l.isActive).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Listings</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your have and want listings
            {pausedCount > 0 && <span className="ml-2 text-amber-600">({pausedCount} paused)</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {tab === "raw" ? (
            <>
              <Button variant="outline" onClick={() => setShowForm("want")}>
                + Want
              </Button>
              <Button onClick={() => setShowForm("have")}>+ Have</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setShowForm("graded-want")}>
                + Want (Graded)
              </Button>
              <Button onClick={() => setShowForm("graded-have")}>+ Have (Graded)</Button>
            </>
          )}
        </div>
      </div>

      {/* Tab toggle + filter */}
      <div className="mt-6 flex items-center gap-4">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setTab("raw")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === "raw"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Raw Cards ({rawCount})
          </button>
          <button
            onClick={() => setTab("graded")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === "graded"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Graded Slabs ({gradedCount})
          </button>
        </div>

        {tab === "raw" && (
          <div className="flex gap-1 text-xs">
            {(["all", "active", "paused"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setViewFilter(f)}
                className={`rounded-full px-3 py-1 capitalize transition-colors ${
                  viewFilter === f
                    ? "bg-indigo-100 text-indigo-700"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Raw card listings */}
      {tab === "raw" && (
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Selling ({filteredHave.length})
            </h2>
            {filteredHave.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
                <p className="text-gray-500">
                  {viewFilter !== "all"
                    ? `No ${viewFilter} have listings.`
                    : "No have listings yet."}
                </p>
                {viewFilter === "all" && (
                  <button
                    onClick={() => setShowForm("have")}
                    className="mt-2 text-sm text-indigo-600 hover:text-indigo-500"
                  >
                    Add a card you want to trade
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredHave.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    id={listing.id}
                    type="have"
                    card={listing.card}
                    condition={listing.condition}
                    quantity={listing.quantity}
                    price={listing.askPrice}
                    currency={listing.currency}
                    notes={listing.notes}
                    isActive={listing.isActive}
                    createdAt={listing.createdAt}
                    onDelete={handleDelete}
                    onUpdate={handleUpdate}
                    aiCCSComposite={listing.aiCCSComposite}
                    sellerOverrodeAI={listing.sellerOverrodeAI}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Buying ({filteredWant.length})
            </h2>
            {filteredWant.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
                <p className="text-gray-500">
                  {viewFilter !== "all"
                    ? `No ${viewFilter} want listings.`
                    : "No want listings yet."}
                </p>
                {viewFilter === "all" && (
                  <button
                    onClick={() => setShowForm("want")}
                    className="mt-2 text-sm text-indigo-600 hover:text-indigo-500"
                  >
                    Add a card you&apos;re looking for
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredWant.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    id={listing.id}
                    type="want"
                    card={listing.card}
                    condition={listing.minCondition}
                    quantity={listing.maxQuantity}
                    price={listing.bidPrice}
                    currency={listing.currency}
                    notes={listing.notes}
                    isActive={listing.isActive}
                    createdAt={listing.createdAt}
                    onDelete={handleDelete}
                    onUpdate={handleUpdate}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Graded card listings */}
      {tab === "graded" && (
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Graded Selling ({gradedHaveListings.length})
            </h2>
            {gradedHaveListings.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
                <p className="text-gray-500">No graded have listings yet.</p>
                <button
                  onClick={() => setShowForm("graded-have")}
                  className="mt-2 text-sm text-indigo-600 hover:text-indigo-500"
                >
                  Add a graded slab you want to trade
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {gradedHaveListings.map((listing) => (
                  <GradedListingCard
                    key={listing.id}
                    id={listing.id}
                    type="have"
                    card={listing.card}
                    gradingCompany={listing.gradingCompany}
                    grade={listing.grade}
                    certNumber={listing.certNumber}
                    price={listing.askPrice}
                    notes={listing.notes}
                    createdAt={listing.createdAt}
                    onDelete={handleGradedDelete}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Graded Buying ({gradedWantListings.length})
            </h2>
            {gradedWantListings.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
                <p className="text-gray-500">No graded want listings yet.</p>
                <button
                  onClick={() => setShowForm("graded-want")}
                  className="mt-2 text-sm text-indigo-600 hover:text-indigo-500"
                >
                  Add a graded card you&apos;re looking for
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {gradedWantListings.map((listing) => (
                  <GradedListingCard
                    key={listing.id}
                    id={listing.id}
                    type="want"
                    card={listing.card}
                    gradingCompany={listing.gradingCompany ?? "PSA"}
                    minGrade={listing.minGrade}
                    maxGrade={listing.maxGrade}
                    price={listing.bidPrice}
                    notes={listing.notes}
                    createdAt={listing.createdAt}
                    onDelete={handleGradedDelete}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Listing Panels */}
      {(showForm === "have" || showForm === "want") && (
        <IntentPanel
          open={true}
          card={null}
          type={showForm}
          onClose={() => setShowForm(null)}
          onCreated={handleCreated}
        />
      )}
      {(showForm === "graded-have" || showForm === "graded-want") && (
        <CreateGradedListingForm
          type={showForm === "graded-have" ? "have" : "want"}
          onClose={() => setShowForm(null)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
