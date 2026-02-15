"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TCG_LABELS, type TCG } from "@/types/domain";

const TCG_OPTIONS: TCG[] = ["POKEMON", "ONEPIECE", "YUGIOH", "MTG"];

interface AuthenticatorProfile {
  id: string;
  applicationStatus: string;
  tier: string;
  region: string;
  businessName: string | null;
  tcgExpertise: string[];
}

interface Region {
  id: string;
  country: string;
  name: string;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "success" | "warning" | "error" | "info" }> = {
  DRAFT: { label: "Draft", variant: "default" },
  SUBMITTED: { label: "Submitted", variant: "info" },
  PENDING_REVIEW: { label: "Under Review", variant: "warning" },
  MORE_INFO_NEEDED: { label: "More Info Needed", variant: "warning" },
  APPROVED: { label: "Approved", variant: "success" },
  ONBOARDING: { label: "Onboarding", variant: "info" },
  ACTIVE: { label: "Active", variant: "success" },
  SUSPENDED: { label: "Suspended", variant: "error" },
  DEACTIVATED: { label: "Deactivated", variant: "default" },
  REVOKED: { label: "Revoked", variant: "error" },
};

export default function AuthenticatorApplyPage() {
  const [profile, setProfile] = useState<AuthenticatorProfile | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Form fields
  const [businessName, setBusinessName] = useState("");
  const [region, setRegion] = useState("");
  const [regionId, setRegionId] = useState("");
  const [tcgExpertise, setTcgExpertise] = useState<TCG[]>([]);
  const [experienceDesc, setExperienceDesc] = useState("");
  const [proofUrls, setProofUrls] = useState<string[]>([""]);

  const fetchData = useCallback(async () => {
    try {
      const [profileRes, regionsRes] = await Promise.all([
        fetch("/api/authenticator/apply"),
        fetch("/api/authenticator/regions"),
      ]);
      if (profileRes.ok) {
        const data = await profileRes.json();
        setProfile(data.authenticator);
      }
      if (regionsRes.ok) {
        const data = await regionsRes.json();
        setRegions(data.regions);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function toggleTcg(tcg: TCG) {
    setTcgExpertise((prev) =>
      prev.includes(tcg) ? prev.filter((t) => t !== tcg) : [...prev, tcg]
    );
  }

  function addProofUrl() {
    if (proofUrls.length < 5) {
      setProofUrls([...proofUrls, ""]);
    }
  }

  function updateProofUrl(index: number, value: string) {
    const updated = [...proofUrls];
    updated[index] = value;
    setProofUrls(updated);
  }

  function removeProofUrl(index: number) {
    if (proofUrls.length > 1) {
      setProofUrls(proofUrls.filter((_, i) => i !== index));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const filteredProofs = proofUrls.filter((u) => u.trim().length > 0);
    if (filteredProofs.length === 0) {
      setError("Provide at least one proof of expertise URL");
      setSubmitting(false);
      return;
    }
    if (tcgExpertise.length === 0) {
      setError("Select at least one TCG");
      setSubmitting(false);
      return;
    }

    const selectedRegion = regions.find((r) => r.id === regionId);

    try {
      const res = await fetch("/api/authenticator/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName || undefined,
          region: selectedRegion?.name || region,
          regionId: regionId || undefined,
          tcgExpertise,
          experienceDesc,
          proofOfExpertise: filteredProofs,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(typeof data.error === "string" ? data.error : "Failed to submit application");
        return;
      }
      fetchData();
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  // Already applied — show status
  if (profile) {
    const statusInfo = STATUS_LABELS[profile.applicationStatus] ?? {
      label: profile.applicationStatus,
      variant: "default" as const,
    };
    const canReapply = profile.applicationStatus === "REVOKED" || profile.applicationStatus === "DRAFT";
    const isActive = profile.applicationStatus === "ACTIVE";

    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900">Authenticator Application</h1>
        <p className="mt-1 text-sm text-gray-600">Your authenticator status</p>

        <Card className="mt-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Application Status</h2>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {profile.businessName && (
                <div>
                  <span className="text-sm font-medium text-gray-500">Business Name</span>
                  <p className="text-sm text-gray-900">{profile.businessName}</p>
                </div>
              )}
              <div>
                <span className="text-sm font-medium text-gray-500">Region</span>
                <p className="text-sm text-gray-900">{profile.region}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Tier</span>
                <p className="text-sm text-gray-900">{profile.tier}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">TCG Expertise</span>
                <div className="mt-1 flex gap-1">
                  {profile.tcgExpertise.map((tcg) => (
                    <Badge key={tcg}>{TCG_LABELS[tcg as TCG] ?? tcg}</Badge>
                  ))}
                </div>
              </div>

              {isActive && (
                <div className="mt-4 rounded-lg bg-green-50 p-3">
                  <p className="text-sm text-green-800">
                    Your authenticator account is active. Visit the{" "}
                    <a href="/authenticator/dashboard" className="font-medium underline">
                      dashboard
                    </a>{" "}
                    to manage your verifications.
                  </p>
                </div>
              )}

              {profile.applicationStatus === "MORE_INFO_NEEDED" && (
                <div className="mt-4 rounded-lg bg-yellow-50 p-3">
                  <p className="text-sm text-yellow-800">
                    Additional information has been requested. Please update your application and resubmit.
                  </p>
                </div>
              )}

              {canReapply && (
                <div className="mt-4">
                  <Button onClick={() => setProfile(null)}>Reapply</Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Application form
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">Become an Authenticator</h1>
      <p className="mt-1 text-sm text-gray-600">
        Authenticators verify trading cards for local trades. You'll inspect cards, confirm
        condition, and ensure authenticity before trades complete.
      </p>

      <Card className="mt-8">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
            )}

            {/* Business Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Business Name (optional)
              </label>
              <Input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Your business or display name"
                className="mt-1"
                maxLength={200}
              />
            </div>

            {/* Region */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Region</label>
              <p className="mt-0.5 text-xs text-gray-500">
                The area where you can physically verify and ship cards
              </p>
              {regions.length > 0 ? (
                <select
                  value={regionId}
                  onChange={(e) => {
                    setRegionId(e.target.value);
                    const r = regions.find((r) => r.id === e.target.value);
                    if (r) setRegion(r.name);
                  }}
                  className="mt-1 flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                  required
                >
                  <option value="">Select a region...</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.country})
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="e.g. Tokyo, London, New York"
                  className="mt-1"
                  required
                />
              )}
            </div>

            {/* TCG Expertise */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                TCG Expertise
              </label>
              <p className="mt-0.5 text-xs text-gray-500">
                Select the card games you can authenticate
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {TCG_OPTIONS.map((tcg) => (
                  <Button
                    key={tcg}
                    type="button"
                    variant={tcgExpertise.includes(tcg) ? "primary" : "outline"}
                    size="sm"
                    onClick={() => toggleTcg(tcg)}
                  >
                    {TCG_LABELS[tcg]}
                  </Button>
                ))}
              </div>
            </div>

            {/* Experience */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Experience Description
              </label>
              <p className="mt-0.5 text-xs text-gray-500">
                Describe your experience with trading card authentication (20+ characters)
              </p>
              <textarea
                value={experienceDesc}
                onChange={(e) => setExperienceDesc(e.target.value)}
                placeholder="Describe your experience with grading, authenticating, or dealing in trading cards..."
                className="mt-1 flex min-h-[100px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                maxLength={2000}
                required
              />
              <p className="mt-1 text-xs text-gray-400">
                {experienceDesc.length}/2000 characters
              </p>
            </div>

            {/* Proof of Expertise */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Proof of Expertise
              </label>
              <p className="mt-0.5 text-xs text-gray-500">
                Links to credentials, marketplace profiles, grading certifications, etc.
              </p>
              <div className="mt-2 space-y-2">
                {proofUrls.map((url, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={url}
                      onChange={(e) => updateProofUrl(i, e.target.value)}
                      placeholder="https://..."
                      type="url"
                    />
                    {proofUrls.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeProofUrl(i)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                {proofUrls.length < 5 && (
                  <Button type="button" variant="outline" size="sm" onClick={addProofUrl}>
                    Add another link
                  </Button>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Application"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
