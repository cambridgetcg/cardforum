"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface KYCSubmission {
  id: string;
  name: string | null;
  email: string;
  kycStatus: string;
  kycSubmittedAt: string | null;
  createdAt: string;
}

const STATUS_BADGE: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  BASIC_PENDING: "warning",
  ENHANCED_PENDING: "warning",
  BASIC_VERIFIED: "success",
  ENHANCED_VERIFIED: "success",
  REJECTED: "error",
  SUSPENDED: "error",
  REVOKED: "error",
};

export default function AdminKYCPage() {
  const [tab, setTab] = useState("all");
  const [submissions, setSubmissions] = useState<KYCSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<KYCSubmission | null>(null);
  const [action, setAction] = useState<"approve" | "reject">("approve");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async (status?: string) => {
    setLoading(true);
    setError("");
    try {
      const params = status && status !== "all" ? `?status=${status}` : "";
      const res = await fetch(`/api/kyc/pending${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setSubmissions(data.submissions ?? []);
    } catch {
      setError("Failed to load KYC submissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const status = tab === "all" ? undefined : tab;
    fetchData(status);
  }, [tab]);

  const handleReview = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/kyc/${selectedUser.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: reason || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to review");
      }
      setDialogOpen(false);
      setReason("");
      fetchData(tab === "all" ? undefined : tab);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to review");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">KYC Review Queue</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="BASIC_PENDING">Basic Pending</TabsTrigger>
          <TabsTrigger value="ENHANCED_PENDING">Enhanced Pending</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <Card>
            <CardHeader>
              <p className="text-sm text-gray-500">
                {submissions.length} submission{submissions.length !== 1 ? "s" : ""}
              </p>
            </CardHeader>
            <CardContent>
              {error && (
                <p className="mb-4 text-sm text-red-600">{error}</p>
              )}
              {loading ? (
                <p className="py-8 text-center text-sm text-gray-500">Loading...</p>
              ) : submissions.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">No pending submissions</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissions.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell className="font-medium">
                          {sub.name ?? "—"}
                        </TableCell>
                        <TableCell>{sub.email}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_BADGE[sub.kycStatus] ?? "outline"}>
                            {sub.kycStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-500">
                          {sub.kycSubmittedAt
                            ? new Date(sub.kycSubmittedAt).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedUser(sub);
                                setAction("approve");
                                setDialogOpen(true);
                              }}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setSelectedUser(sub);
                                setAction("reject");
                                setDialogOpen(true);
                              }}
                            >
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "approve" ? "Approve" : "Reject"} KYC — {selectedUser?.email}
            </DialogTitle>
          </DialogHeader>
          {action === "reject" && (
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={3}
              placeholder="Rejection reason..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={action === "approve" ? "primary" : "destructive"}
              onClick={handleReview}
              disabled={submitting}
            >
              {submitting ? "Submitting..." : action === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
