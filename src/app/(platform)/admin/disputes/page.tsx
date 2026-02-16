"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

interface Dispute {
  id: string;
  tradeId: string;
  tradeLegId: string | null;
  raisedById: string;
  reason: string;
  status: string;
  resolution: string | null;
  createdAt: string;
  raisedBy?: { name: string | null; email: string };
  trade?: { id: string; status: string };
}

const STATUS_BADGE: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  OPEN: "warning",
  INVESTIGATING: "info",
  RESOLVED_BUYER: "success",
  RESOLVED_SELLER: "success",
  ESCALATED: "error",
  CLOSED: "default",
};

const FILTER_TABS = [
  { label: "All", value: "" },
  { label: "Open", value: "OPEN" },
  { label: "Investigating", value: "INVESTIGATING" },
  { label: "Escalated", value: "ESCALATED" },
  { label: "Resolved", value: "resolved" },
] as const;

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  const fetchData = async (statusFilter: string) => {
    setLoading(true);
    setError("");
    try {
      const params = statusFilter ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/admin/disputes${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setDisputes(data.disputes ?? []);
    } catch {
      setError("Failed to load disputes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(filter);
  }, [filter]);

  const filteredDisputes =
    filter === "resolved"
      ? disputes.filter((d) => ["RESOLVED_BUYER", "RESOLVED_SELLER", "CLOSED"].includes(d.status))
      : disputes;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dispute Resolution</h1>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {FILTER_TABS.map((tab) => (
          <Button
            key={tab.value}
            size="sm"
            variant={filter === tab.value ? "primary" : "outline"}
            onClick={() => setFilter(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-gray-500">
            {filteredDisputes.length} dispute{filteredDisputes.length !== 1 ? "s" : ""}
          </p>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
          {loading ? (
            <p className="py-8 text-center text-sm text-gray-500">Loading...</p>
          ) : filteredDisputes.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No disputes</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Trade</TableHead>
                  <TableHead>Raised By</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDisputes.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/admin/disputes/${d.id}`}
                        className="text-indigo-600 hover:underline"
                      >
                        {d.id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/trades/${d.tradeId}`}
                        className="text-indigo-600 hover:underline"
                      >
                        {d.tradeId.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {d.raisedBy?.name ?? d.raisedBy?.email ?? d.raisedById.slice(0, 8)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{d.reason}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[d.status] ?? "default"}>{d.status}</Badge>
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {new Date(d.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/disputes/${d.id}`}>
                        <Button size="sm" variant="outline">
                          View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
