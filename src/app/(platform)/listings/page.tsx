"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ListingCard } from "@/components/listings/listing-card";
import { GradedListingCard } from "@/components/listings/graded-listing-card";
import { CreateListingForm } from "@/components/listings/create-listing-form";
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
  notes: string | null;
  createdAt: string;
  card: CardData;
  // AI condition trust fields
  aiCCSComposite: number | null;
  sellerOverrodeAI: boolean;
}

interface WantListing {
  id: string;
  minCondition: Condition;
  maxQuantity: number;
  bidPrice: number;
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

export default function ListingsPage() {
  const [tab, setTab] = useState<Tab>("raw");
  const [haveListings, setHaveListings] = useState<HaveListing[]>([]);
  const [wantListings, setWantListings] = useState<WantListing[]>([]);
  const [gradedHaveListings, setGradedHaveListings] = useState<GradedHaveListing[]>([]);
  const [gradedWantListings, setGradedWantListings] = useState<GradedWantListing[]>([]);
  const [showForm, setShowForm] = useState<FormMode>(null);
  const [loading, setLoading] = useState(true);

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

  async function handleGradedDelete(id: string, type: "have" | "want") {
    await fetch(`/api/graded-listings?id=${id}&type=${type}`, { method: "DELETE" });
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

  const rawCount = haveListings.length + wantListings.length;
  const gradedCount = gradedHaveListings.length + gradedWantListings.length;

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
          {tab === "raw" ? (
            <>
              <Button variant="outline" onClick={() => setShowForm("want")}>
                + Want
              </Button>
              <Button onClick={() => setShowForm("have")}>
                + Have
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setShowForm("graded-want")}>
                + Want (Graded)
              </Button>
              <Button onClick={() => setShowForm("graded-have")}>
                + Have (Graded)
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tab toggle */}
      <div className="mt-6 flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
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

      {/* Raw card listings */}
      {tab === "raw" && (
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
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
                    price={listing.askPrice}
                    notes={listing.notes}
                    createdAt={listing.createdAt}
                    onDelete={handleDelete}
                    aiCCSComposite={listing.aiCCSComposite}
                    sellerOverrodeAI={listing.sellerOverrodeAI}
                  />
                ))}
              </div>
            )}
          </div>

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
                    price={listing.bidPrice}
                    notes={listing.notes}
                    createdAt={listing.createdAt}
                    onDelete={handleDelete}
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
              Graded Cards I Have ({gradedHaveListings.length})
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
              Graded Cards I Want ({gradedWantListings.length})
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

      {/* Create Listing Modals */}
      {(showForm === "have" || showForm === "want") && (
        <CreateListingForm
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
