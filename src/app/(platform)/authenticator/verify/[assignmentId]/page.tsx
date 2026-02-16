"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  formatPrice,
  CONDITION_LABELS,
  TCG_LABELS,
  type TCG,
  type Condition,
} from "@/types/domain";

const CONDITIONS: Condition[] = ["NM", "LP", "MP", "HP", "DMG"];
const CONFIDENCE_LEVELS = ["HIGH", "MEDIUM", "LOW"] as const;

interface AssignmentData {
  id: string;
  assignedAt: string;
  completedAt: string | null;
  tradeLeg: {
    id: string;
    haveListing?: {
      askPrice: number;
      condition: string;
      card: {
        id: string;
        name: string;
        tcg: string;
        setName: string;
        setCode: string | null;
        number: string | null;
      };
    } | null;
    gradedHaveListing?: {
      askPrice: number;
      grade: number;
      gradingCompany: string;
      certNumber: string;
      card: {
        id: string;
        name: string;
        tcg: string;
        setName: string;
        setCode: string | null;
        number: string | null;
      };
    } | null;
    photoApproval?: {
      photos: string[];
      status: string;
    } | null;
  };
}

export default function VerificationPage() {
  const params = useParams<{ assignmentId: string }>();
  const [assignment, setAssignment] = useState<AssignmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Form fields
  const [authentic, setAuthentic] = useState(true);
  const [conditionVerified, setConditionVerified] = useState<Condition>("NM");
  const [conditionMatchesListing, setConditionMatchesListing] = useState(true);
  const [notes, setNotes] = useState("");
  const [defects, setDefects] = useState<string[]>([]);
  const [defectInput, setDefectInput] = useState("");
  const [confidenceLevel, setConfidenceLevel] = useState<"HIGH" | "MEDIUM" | "LOW">("HIGH");
  const [photoUrls, setPhotoUrls] = useState<string[]>(["", "", "", ""]);
  // Graded-specific
  const [slabIntact, setSlabIntact] = useState(true);
  const [certVerified, setCertVerified] = useState(true);

  const fetchAssignment = useCallback(async () => {
    try {
      const res = await fetch(`/api/authenticator/verify/${params.assignmentId}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to load assignment");
        return;
      }
      const data = await res.json();
      setAssignment(data.assignment);

      // Pre-fill condition from listing
      const listing = data.assignment.tradeLeg.haveListing;
      if (listing?.condition) {
        setConditionVerified(listing.condition as Condition);
      }
    } finally {
      setLoading(false);
    }
  }, [params.assignmentId]);

  useEffect(() => {
    fetchAssignment();
  }, [fetchAssignment]);

  function addDefect() {
    const trimmed = defectInput.trim();
    if (trimmed && defects.length < 10) {
      setDefects([...defects, trimmed]);
      setDefectInput("");
    }
  }

  function removeDefect(index: number) {
    setDefects(defects.filter((_, i) => i !== index));
  }

  function updatePhotoUrl(index: number, value: string) {
    const updated = [...photoUrls];
    updated[index] = value;
    setPhotoUrls(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const filteredPhotos = photoUrls.filter((u) => u.trim().length > 0);
    if (filteredPhotos.length < 4) {
      setError("Please provide at least 4 photo URLs (front, back, close-ups)");
      setSubmitting(false);
      return;
    }

    const isGraded = !!assignment?.tradeLeg.gradedHaveListing;

    try {
      const res = await fetch(`/api/authenticator/verify/${params.assignmentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authentic,
          conditionVerified,
          conditionMatchesListing,
          notes,
          photos: filteredPhotos,
          defects,
          confidenceLevel,
          ...(isGraded ? { slabIntact, certVerified } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(typeof data.error === "string" ? data.error : "Failed to submit verification");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-gray-500">Loading assignment...</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-bold text-gray-900">Verification Submitted</h2>
            <p className="mt-2 text-sm text-gray-600">
              Your verification result has been recorded. Thank you for your work.
            </p>
            <Button
              className="mt-4"
              onClick={() => (window.location.href = "/authenticator/dashboard")}
            >
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">{error || "Assignment not found"}</p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => (window.location.href = "/authenticator/dashboard")}
            >
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (assignment.completedAt) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">This verification has already been completed.</p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => (window.location.href = "/authenticator/dashboard")}
            >
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const listing = assignment.tradeLeg.haveListing;
  const graded = assignment.tradeLeg.gradedHaveListing;
  const card = listing?.card ?? graded?.card;
  const isGraded = !!graded;
  const approvedPhotos = assignment.tradeLeg.photoApproval?.photos ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">Card Verification</h1>
      <p className="mt-1 text-sm text-gray-600">
        Inspect the physical card and submit your verification result
      </p>

      {/* Card Details */}
      <Card className="mt-6">
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Card Details</h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">{card?.name ?? "Unknown"}</h3>
              <Badge>{TCG_LABELS[card?.tcg as TCG] ?? card?.tcg}</Badge>
            </div>
            <p className="text-sm text-gray-600">
              {card?.setName}
              {card?.setCode && ` (${card.setCode})`}
              {card?.number && ` #${card.number}`}
            </p>
            <div className="flex gap-4 text-sm text-gray-500">
              <span>Value: {formatPrice(listing?.askPrice ?? graded?.askPrice ?? 0)}</span>
              {listing && (
                <span>
                  Listed Condition:{" "}
                  <strong>
                    {CONDITION_LABELS[listing.condition as Condition] ?? listing.condition}
                  </strong>
                </span>
              )}
              {graded && (
                <>
                  <span>
                    Grade:{" "}
                    <strong>
                      {graded.gradingCompany} {graded.grade}
                    </strong>
                  </span>
                  <span>Cert: {graded.certNumber}</span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Listing Photos */}
      {approvedPhotos.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Listing Photos</h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {approvedPhotos.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-lg border border-gray-200"
                >
                  <img src={url} alt={`Photo ${i + 1}`} className="h-32 w-full object-cover" />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Verification Form */}
      <Card className="mt-4">
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Verification Result</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

            {/* Authenticity */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Is this card authentic?
              </label>
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  variant={authentic ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setAuthentic(true)}
                >
                  Authentic
                </Button>
                <Button
                  type="button"
                  variant={!authentic ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => setAuthentic(false)}
                >
                  Counterfeit
                </Button>
              </div>
            </div>

            {/* Verified Condition */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Verified Condition</label>
              <p className="mt-0.5 text-xs text-gray-500">
                Your assessment of the card&apos;s actual condition
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {CONDITIONS.map((c) => (
                  <Button
                    key={c}
                    type="button"
                    variant={conditionVerified === c ? "primary" : "outline"}
                    size="sm"
                    onClick={() => {
                      setConditionVerified(c);
                      // Auto-update match status
                      const listedCondition = listing?.condition;
                      if (listedCondition) {
                        setConditionMatchesListing(c === listedCondition);
                      }
                    }}
                  >
                    {c}
                    <span className="ml-1 hidden text-xs opacity-70 sm:inline">
                      {CONDITION_LABELS[c]}
                    </span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Condition Match */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Does condition match listing?
              </label>
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  variant={conditionMatchesListing ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setConditionMatchesListing(true)}
                >
                  Yes, matches
                </Button>
                <Button
                  type="button"
                  variant={!conditionMatchesListing ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => setConditionMatchesListing(false)}
                >
                  No, mismatch
                </Button>
              </div>
            </div>

            {/* Graded-specific fields */}
            {isGraded && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Is the slab intact?
                  </label>
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      variant={slabIntact ? "primary" : "outline"}
                      size="sm"
                      onClick={() => setSlabIntact(true)}
                    >
                      Intact
                    </Button>
                    <Button
                      type="button"
                      variant={!slabIntact ? "destructive" : "outline"}
                      size="sm"
                      onClick={() => setSlabIntact(false)}
                    >
                      Damaged/Tampered
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Certification number verified?
                  </label>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Cert #{graded?.certNumber} — verify against the grading company&apos;s database
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      variant={certVerified ? "primary" : "outline"}
                      size="sm"
                      onClick={() => setCertVerified(true)}
                    >
                      Verified
                    </Button>
                    <Button
                      type="button"
                      variant={!certVerified ? "destructive" : "outline"}
                      size="sm"
                      onClick={() => setCertVerified(false)}
                    >
                      Cannot Verify
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Confidence Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Confidence Level</label>
              <div className="mt-2 flex gap-2">
                {CONFIDENCE_LEVELS.map((level) => (
                  <Button
                    key={level}
                    type="button"
                    variant={confidenceLevel === level ? "primary" : "outline"}
                    size="sm"
                    onClick={() => setConfidenceLevel(level)}
                  >
                    {level}
                  </Button>
                ))}
              </div>
            </div>

            {/* Defects */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Defects Found</label>
              <div className="mt-2 flex gap-2">
                <Input
                  value={defectInput}
                  onChange={(e) => setDefectInput(e.target.value)}
                  placeholder="e.g. Surface scratch on holo"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addDefect();
                    }
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={addDefect}>
                  Add
                </Button>
              </div>
              {defects.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {defects.map((d, i) => (
                    <Badge key={i} variant="warning">
                      {d}
                      <button
                        type="button"
                        className="ml-1 text-yellow-600 hover:text-yellow-800"
                        onClick={() => removeDefect(i)}
                      >
                        &times;
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional observations about the card..."
                className="mt-1 flex min-h-[80px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:outline-none"
                maxLength={2000}
              />
            </div>

            {/* Photo URLs */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Verification Photos (minimum 4)
              </label>
              <p className="mt-0.5 text-xs text-gray-500">
                Front, back, and close-up photos of the card you physically inspected
              </p>
              <div className="mt-2 space-y-2">
                {photoUrls.map((url, i) => (
                  <Input
                    key={i}
                    value={url}
                    onChange={(e) => updatePhotoUrl(i, e.target.value)}
                    placeholder={`Photo ${i + 1} URL`}
                    type="url"
                  />
                ))}
                {photoUrls.length < 10 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPhotoUrls([...photoUrls, ""])}
                  >
                    Add another photo
                  </Button>
                )}
              </div>
            </div>

            {/* Warning for negative results */}
            {(!authentic || !conditionMatchesListing) && (
              <div className="rounded-lg bg-red-50 p-3">
                <p className="text-sm font-medium text-red-800">
                  This verification will flag the card as{" "}
                  {!authentic ? "counterfeit" : "condition mismatch"}. The trade will enter a
                  DISPUTED state and a dispute record will be created.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => (window.location.href = "/authenticator/dashboard")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Verification"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
