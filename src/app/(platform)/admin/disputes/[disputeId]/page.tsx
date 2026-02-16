"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";

interface TradeLeg {
  id: string;
  fromUserId: string;
  toUserId: string;
  region: string;
  status: string;
  haveListing?: { askPrice: number; card: { name: string } } | null;
  verification?: {
    result: Record<string, unknown> | null;
    authenticator: { businessName: string | null; tier: string } | null;
  } | null;
}

interface DisputeDetail {
  id: string;
  tradeId: string;
  tradeLegId: string | null;
  raisedById: string;
  reason: string;
  evidence: string[];
  status: string;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
  trade: {
    id: string;
    status: string;
    userAId: string;
    userBId: string;
    legs: TradeLeg[];
    escrow: {
      id: string;
      status: string;
      entries: Array<{ type: string; amount: number; note: string | null }>;
    } | null;
  };
}

const STATUS_BADGE: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  OPEN: "warning",
  INVESTIGATING: "info",
  RESOLVED_BUYER: "success",
  RESOLVED_SELLER: "success",
  ESCALATED: "error",
  CLOSED: "default",
};

const RESOLUTION_OPTIONS = [
  { value: "RESOLVED_BUYER", label: "Resolve for Buyer (refund all)" },
  { value: "RESOLVED_SELLER", label: "Resolve for Seller (re-enable trade)" },
  { value: "ESCALATED", label: "Escalate for higher review" },
  { value: "CLOSED", label: "Close (refund all)" },
];

export default function AdminDisputeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const disputeId = params.disputeId as string;

  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [resolutionStatus, setResolutionStatus] = useState("RESOLVED_BUYER");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/disputes/${disputeId}`);
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        setDispute(data.dispute);
      } catch {
        setError("Failed to load dispute");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [disputeId]);

  const handleResolve = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/disputes/${disputeId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: resolutionStatus,
          resolution: resolutionNotes,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to resolve");
      }
      router.push("/admin/disputes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="py-12 text-center text-sm text-gray-500">Loading dispute...</p>;
  }

  if (!dispute) {
    return <p className="py-12 text-center text-sm text-red-500">{error || "Dispute not found"}</p>;
  }

  const isResolvable = ["OPEN", "INVESTIGATING", "ESCALATED"].includes(dispute.status);
  const escrowTotal =
    dispute.trade.escrow?.entries
      .filter((e) => e.type === "HOLD")
      .reduce((sum, e) => sum + e.amount, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/disputes" className="text-sm text-indigo-600 hover:underline">
            &larr; Back to disputes
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">
            Dispute {dispute.id.slice(0, 8)}
          </h1>
        </div>
        <Badge variant={STATUS_BADGE[dispute.status] ?? "default"} className="text-sm">
          {dispute.status}
        </Badge>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Dispute Info */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Dispute Details</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Reason:</span>
              <p className="font-medium">{dispute.reason}</p>
            </div>
            <div>
              <span className="text-gray-500">Filed:</span>
              <p className="font-medium">{new Date(dispute.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-gray-500">Trade:</span>
              <p>
                <Link
                  href={`/trades/${dispute.tradeId}`}
                  className="font-mono text-indigo-600 hover:underline"
                >
                  {dispute.tradeId.slice(0, 12)}
                </Link>{" "}
                <Badge
                  variant={STATUS_BADGE[dispute.trade.status] ?? "default"}
                  className="text-xs"
                >
                  {dispute.trade.status}
                </Badge>
              </p>
            </div>
            <div>
              <span className="text-gray-500">Raised By:</span>
              <p className="font-mono text-xs">{dispute.raisedById.slice(0, 12)}</p>
            </div>
            {dispute.resolution && (
              <div className="col-span-2">
                <span className="text-gray-500">Resolution:</span>
                <p className="font-medium">{dispute.resolution}</p>
              </div>
            )}
          </div>

          {/* Evidence */}
          {dispute.evidence.length > 0 && (
            <div>
              <span className="text-sm text-gray-500">
                Evidence ({dispute.evidence.length} items):
              </span>
              <div className="mt-2 flex gap-2 overflow-x-auto">
                {dispute.evidence.map((item, i) =>
                  item.startsWith("data:image/") ? (
                    <img
                      key={i}
                      src={item}
                      alt={`Evidence ${i + 1}`}
                      className="h-24 w-24 rounded border object-cover"
                    />
                  ) : (
                    <p key={i} className="rounded bg-gray-50 px-3 py-2 text-xs">
                      {item}
                    </p>
                  ),
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trade Legs */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Trade Legs ({dispute.trade.legs.length})</h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dispute.trade.legs.map((leg) => (
              <div
                key={leg.id}
                className={`rounded-lg border p-3 text-sm ${
                  leg.id === dispute.tradeLegId ? "border-indigo-300 bg-indigo-50" : "bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {leg.haveListing?.card.name ?? "Unknown card"}
                  </span>
                  <Badge variant="default" className="text-xs">
                    {leg.status}
                  </Badge>
                </div>
                <div className="mt-1 text-gray-500">
                  Region: {leg.region}
                  {leg.haveListing && ` | Value: $${(leg.haveListing.askPrice / 100).toFixed(2)}`}
                  {leg.verification?.authenticator && (
                    <>
                      {" "}
                      | Authenticator: {leg.verification.authenticator.businessName ?? "Unknown"} (
                      {leg.verification.authenticator.tier})
                    </>
                  )}
                </div>
                {leg.id === dispute.tradeLegId && (
                  <p className="mt-1 text-xs font-medium text-indigo-600">Disputed leg</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Escrow */}
      {dispute.trade.escrow && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Escrow</h2>
          </CardHeader>
          <CardContent>
            <div className="mb-2 text-sm">
              Status: <Badge variant="default">{dispute.trade.escrow.status}</Badge>
              {" | "}Total held: ${(escrowTotal / 100).toFixed(2)}
            </div>
            {dispute.trade.escrow.entries.length > 0 && (
              <div className="space-y-1">
                {dispute.trade.escrow.entries.map((entry, i) => (
                  <div
                    key={i}
                    className="flex justify-between rounded bg-gray-50 px-3 py-1 text-xs"
                  >
                    <span>{entry.type}</span>
                    <span>${(entry.amount / 100).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Resolution Form */}
      {isResolvable && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Resolve Dispute</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Resolution</label>
              <Select
                value={resolutionStatus}
                onChange={(e) => setResolutionStatus(e.target.value)}
              >
                {RESOLUTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
              <textarea
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                rows={3}
                placeholder="Explain the resolution decision..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button onClick={handleResolve} disabled={submitting || !resolutionNotes.trim()}>
                {submitting ? "Resolving..." : "Resolve Dispute"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
