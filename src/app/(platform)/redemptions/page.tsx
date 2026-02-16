"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RedemptionCard } from "@/components/digitisation/redemption-card";
import type { Condition, RedemptionStatus } from "@/types/domain";

interface Redemption {
  id: string;
  status: RedemptionStatus;
  vaultCountry: string;
  redeemerCountry: string;
  isCrossZone: boolean;
  redemptionFeeCents: number;
  crossZoneSurcharge: number;
  trackingOutbound: string | null;
  createdAt: string;
  token: {
    card: {
      name: string;
      setName: string;
      setCode: string | null;
      number: string | null;
    };
    condition: Condition;
  };
  vaultAuthenticator: {
    businessName: string | null;
    region: string;
  };
}

function RedemptionsContent() {
  const searchParams = useSearchParams();
  const tokenIdParam = searchParams.get("tokenId");

  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);

  // New redemption form state
  const [showNewForm, setShowNewForm] = useState(!!tokenIdParam);
  const [newTokenId, setNewTokenId] = useState(tokenIdParam ?? "");
  const [country, setCountry] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchRedemptions = useCallback(async () => {
    try {
      const res = await fetch("/api/redemptions");
      if (res.ok) {
        const data = await res.json();
        setRedemptions(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRedemptions();
  }, [fetchRedemptions]);

  async function handleSubmitRedemption(e: React.FormEvent) {
    e.preventDefault();
    if (!newTokenId || !country) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/redemptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenId: newTokenId,
          redeemerCountry: country.toUpperCase(),
        }),
      });

      if (res.ok) {
        setShowNewForm(false);
        setNewTokenId("");
        setCountry("");
        fetchRedemptions();
      } else {
        const data = await res.json();
        setError(typeof data.error === "string" ? data.error : "Redemption failed");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm(id: string) {
    const res = await fetch(`/api/redemptions/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm" }),
    });
    if (res.ok) fetchRedemptions();
  }

  async function handleCancel(id: string) {
    const res = await fetch(`/api/redemptions/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    if (res.ok) fetchRedemptions();
  }

  if (loading) {
    return <p className="text-gray-500">Loading redemptions...</p>;
  }

  return (
    <>
      {/* New redemption form */}
      {showNewForm && (
        <form
          onSubmit={handleSubmitRedemption}
          className="mt-6 space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <h3 className="text-sm font-semibold text-gray-900">Request Redemption</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700">Token ID</label>
            <Input
              value={newTokenId}
              onChange={(e) => setNewTokenId(e.target.value)}
              placeholder="Token ID"
              className="mt-1"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Your Country (ISO code)
            </label>
            <Input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. US, JP, DE"
              className="mt-1 w-24"
              maxLength={2}
              required
            />
            <p className="mt-1 text-xs text-gray-400">
              We&apos;ll find the nearest vault. Cross-zone incurs a $15 surcharge.
            </p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Requesting..." : "Request Redemption"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowNewForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Redemption list */}
      <div className="mt-6 space-y-3">
        {redemptions.length === 0 && !showNewForm ? (
          <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
            <p className="text-gray-500">No redemptions yet.</p>
            <p className="mt-1 text-sm text-gray-400">
              Redeem a digital token to receive a physical card.
            </p>
          </div>
        ) : (
          redemptions.map((r) => (
            <RedemptionCard
              key={r.id}
              id={r.id}
              status={r.status}
              token={r.token}
              vaultAuthenticator={r.vaultAuthenticator}
              vaultCountry={r.vaultCountry}
              redeemerCountry={r.redeemerCountry}
              isCrossZone={r.isCrossZone}
              redemptionFeeCents={r.redemptionFeeCents}
              crossZoneSurcharge={r.crossZoneSurcharge}
              trackingOutbound={r.trackingOutbound}
              createdAt={r.createdAt}
              onConfirm={handleConfirm}
              onCancel={handleCancel}
            />
          ))
        )}
      </div>
    </>
  );
}

export default function RedemptionsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Redemptions</h1>
          <p className="mt-1 text-sm text-gray-600">Track your physical card redemption requests</p>
        </div>
      </div>
      <Suspense fallback={<p className="mt-6 text-gray-500">Loading...</p>}>
        <RedemptionsContent />
      </Suspense>
    </div>
  );
}
