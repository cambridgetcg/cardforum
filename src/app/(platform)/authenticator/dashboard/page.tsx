"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPrice, TCG_LABELS, type TCG } from "@/types/domain";
import { formatRelativeTime } from "@/lib/utils";

interface AuthenticatorInfo {
  id: string;
  businessName: string | null;
  tier: string;
  region: string;
  tcgExpertise: string[];
  rating: number;
  totalVerified: number;
  currentLoad: number;
  maxLoad: number;
}

interface Assignment {
  id: string;
  assignedAt: string;
  completedAt: string | null;
  acceptedAt: string | null;
  tradeLeg: {
    id: string;
    haveListing?: {
      askPrice: number;
      condition: string;
      card: { name: string; tcg: string; setName: string };
    } | null;
    gradedHaveListing?: {
      askPrice: number;
      grade: number;
      gradingCompany: string;
      certNumber: string;
      card: { name: string; tcg: string; setName: string };
    } | null;
    photoApproval?: {
      photos: string[];
      status: string;
    } | null;
  };
}

interface Rating {
  id: string;
  score: number;
  accuracyScore: number | null;
  speedScore: number | null;
  satisfactionScore: number | null;
  communicationScore: number | null;
  comment: string | null;
  createdAt: string;
}

const TIER_COLORS: Record<string, "default" | "info" | "success" | "warning"> = {
  STANDARD: "default",
  VERIFIED: "info",
  PREMIUM: "success",
};

export default function AuthenticatorDashboardPage() {
  const [authenticator, setAuthenticator] = useState<AuthenticatorInfo | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/authenticator/dashboard");
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to load dashboard");
        return;
      }
      const data = await res.json();
      setAuthenticator(data.authenticator);
      setAssignments(data.pendingAssignments ?? []);
      setRatings(data.recentRatings ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900">Authenticator Dashboard</h1>
        <Card className="mt-8">
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">{error}</p>
            {error.includes("Not an authenticator") && (
              <Button className="mt-4" onClick={() => (window.location.href = "/authenticator/apply")}>
                Apply to Become an Authenticator
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!authenticator) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Authenticator Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            {authenticator.businessName ?? "Authenticator"} &middot; {authenticator.region}
          </p>
        </div>
        <Badge variant={TIER_COLORS[authenticator.tier] ?? "default"}>
          {authenticator.tier}
        </Badge>
      </div>

      {/* Stats Overview */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {authenticator.rating.toFixed(1)}
            </p>
            <p className="text-xs text-gray-500">Rating</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {authenticator.totalVerified}
            </p>
            <p className="text-xs text-gray-500">Verified</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {authenticator.currentLoad}/{authenticator.maxLoad}
            </p>
            <p className="text-xs text-gray-500">Current Load</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="flex flex-wrap justify-center gap-1">
              {authenticator.tcgExpertise.map((tcg) => (
                <Badge key={tcg} variant="default">
                  {TCG_LABELS[tcg as TCG] ?? tcg}
                </Badge>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-500">Expertise</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Assignments */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Pending Assignments ({assignments.length})
        </h2>
        {assignments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">
                No pending verification assignments. New assignments will appear here
                when trades enter the authentication phase.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {assignments.map((assignment) => {
              const listing =
                assignment.tradeLeg.haveListing ??
                assignment.tradeLeg.gradedHaveListing;
              const isGraded = !!assignment.tradeLeg.gradedHaveListing;
              const graded = assignment.tradeLeg.gradedHaveListing;
              const hasPhotos =
                assignment.tradeLeg.photoApproval?.status === "APPROVED";

              return (
                <Card key={assignment.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">
                            {listing?.card.name ?? "Unknown Card"}
                          </h3>
                          {isGraded && graded && (
                            <Badge variant="info">
                              {graded.gradingCompany} {graded.grade}
                            </Badge>
                          )}
                          {!isGraded && assignment.tradeLeg.haveListing && (
                            <Badge>{assignment.tradeLeg.haveListing.condition}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {listing?.card.setName} &middot;{" "}
                          {TCG_LABELS[listing?.card.tcg as TCG] ?? listing?.card.tcg}
                        </p>
                        <p className="text-xs text-gray-400">
                          Value: {formatPrice(listing?.askPrice ?? 0)} &middot;
                          Assigned {formatRelativeTime(new Date(assignment.assignedAt))}
                          {hasPhotos && (
                            <span className="ml-2 text-green-600">Photos available</span>
                          )}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() =>
                          (window.location.href = `/authenticator/verify/${assignment.id}`)
                        }
                      >
                        Verify
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Ratings */}
      {ratings.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Recent Ratings
          </h2>
          <div className="space-y-3">
            {ratings.map((rating) => (
              <Card key={rating.id}>
                <CardContent className="py-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-gray-900">
                          {rating.score.toFixed(1)}
                        </span>
                        <div className="flex gap-2 text-xs text-gray-500">
                          {rating.accuracyScore != null && (
                            <span>Accuracy: {rating.accuracyScore.toFixed(1)}</span>
                          )}
                          {rating.speedScore != null && (
                            <span>Speed: {rating.speedScore.toFixed(1)}</span>
                          )}
                          {rating.satisfactionScore != null && (
                            <span>Satisfaction: {rating.satisfactionScore.toFixed(1)}</span>
                          )}
                          {rating.communicationScore != null && (
                            <span>Comm: {rating.communicationScore.toFixed(1)}</span>
                          )}
                        </div>
                      </div>
                      {rating.comment && (
                        <p className="text-sm text-gray-600">{rating.comment}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {formatRelativeTime(new Date(rating.createdAt))}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
