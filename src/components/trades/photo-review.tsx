"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MAX_PHOTO_ATTEMPTS } from "@/lib/constants";

interface PhotoReviewProps {
  tradeId: string;
  legId: string;
  photos: string[];
  attempts: number;
  onReviewed: () => void;
}

export function PhotoReview({ tradeId, legId, photos, attempts, onReviewed }: PhotoReviewProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionNote, setRejectionNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleDecision(approved: boolean) {
    if (!approved && !rejectionNote.trim()) {
      setError("Please provide a reason for rejection");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/trades/${tradeId}/legs/${legId}/photos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approved,
          ...(approved ? {} : { rejectionNote: rejectionNote.trim() }),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Review failed");
      }
      onReviewed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-2 space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
      <p className="text-xs text-gray-500">
        Attempt {attempts} of {MAX_PHOTO_ATTEMPTS}
      </p>

      <div className="flex gap-2">
        {photos.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={`Card photo ${i + 1}`}
            className="h-24 w-24 cursor-pointer rounded-md border object-cover transition-transform hover:scale-105"
            onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
          />
        ))}
      </div>

      {expandedIndex !== null && photos[expandedIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setExpandedIndex(null)}
        >
          <img
            src={photos[expandedIndex]}
            alt="Enlarged card photo"
            className="max-h-[80vh] max-w-[90vw] rounded-lg"
          />
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {rejecting ? (
        <div className="space-y-2">
          <textarea
            className="w-full rounded-md border border-gray-300 p-2 text-sm"
            rows={3}
            placeholder="Reason for rejection (required)"
            value={rejectionNote}
            onChange={(e) => setRejectionNote(e.target.value)}
            maxLength={500}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleDecision(false)}
              disabled={submitting}
            >
              {submitting ? "Rejecting..." : "Confirm Reject"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setRejecting(false);
                setRejectionNote("");
                setError("");
              }}
            >
              Back
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => handleDecision(true)} disabled={submitting}>
            {submitting ? "Approving..." : "Approve"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setRejecting(true)}>
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}
