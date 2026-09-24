"use client";

import { useEffect, useState, useCallback } from "react";
import { DigitisationRequestCard } from "@/components/digitisation/digitisation-request-card";
import type { Condition, DigitisationStatus } from "@/types/domain";

interface DigitisationRequest {
  id: string;
  status: DigitisationStatus;
  condition: Condition;
  verifiedCondition: Condition | null;
  verificationFeeCents: number;
  trackingInbound: string | null;
  createdAt: string;
  card: {
    name: string;
    setName: string;
    setCode: string | null;
    number: string | null;
  };
  authenticator: {
    id: string;
    businessName: string | null;
    region: string;
  };
}

export default function DigitisationPage() {
  const [requests, setRequests] = useState<DigitisationRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/digitisation");
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  async function handleCancel(id: string) {
    const res = await fetch(`/api/digitisation/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    if (res.ok) fetchRequests();
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-gray-500">Loading digitisation requests...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Digitisation</h1>
          <p className="mt-1 text-sm text-gray-600">
            Track existing digitisation requests. New paid requests are retired.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {requests.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
            <p className="text-gray-500">No digitisation requests yet.</p>
            <p className="mt-1 text-sm text-gray-400">
              Existing requests and cancellation remain available.
            </p>
          </div>
        ) : (
          requests.map((req) => (
            <DigitisationRequestCard
              key={req.id}
              id={req.id}
              status={req.status}
              card={req.card}
              condition={req.condition}
              verifiedCondition={req.verifiedCondition}
              authenticator={req.authenticator}
              verificationFeeCents={req.verificationFeeCents}
              trackingInbound={req.trackingInbound}
              createdAt={req.createdAt}
              onCancel={handleCancel}
            />
          ))
        )}
      </div>
    </div>
  );
}
