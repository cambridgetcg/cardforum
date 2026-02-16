"use client";

import { useEffect, useState } from "react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Application {
  id: string;
  userId: string;
  applicationStatus: string;
  region: string;
  specializations: string[];
  tier: string;
  createdAt: string;
  user?: { name: string | null; email: string };
}

const STATUS_BADGE: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  SUBMITTED: "warning",
  APPROVED: "info",
  ACTIVE: "success",
  REJECTED: "error",
  SUSPENDED: "error",
  ONBOARDING: "default",
};

export default function AdminAuthenticatorsPage() {
  const [tab, setTab] = useState("SUBMITTED");
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [reviewAction, setReviewAction] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async (status?: string) => {
    setLoading(true);
    setError("");
    try {
      const params = status && status !== "all" ? `?status=${status}` : "";
      const res = await fetch(`/api/authenticator/applications${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setApplications(data.applications ?? []);
    } catch {
      setError("Failed to load applications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const status = tab === "all" ? undefined : tab;
    fetchData(status);
  }, [tab]);

  const handleReview = async () => {
    if (!selectedApp) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/authenticator/applications/${selectedApp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: reviewAction === "APPROVED" ? "approve" : "reject",
          reason: reason || undefined,
        }),
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
      <h1 className="text-2xl font-bold text-gray-900">Authenticator Applications</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="SUBMITTED">Submitted</TabsTrigger>
          <TabsTrigger value="APPROVED">Approved</TabsTrigger>
          <TabsTrigger value="ACTIVE">Active</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <Card>
            <CardHeader>
              <p className="text-sm text-gray-500">
                {applications.length} application{applications.length !== 1 ? "s" : ""}
              </p>
            </CardHeader>
            <CardContent>
              {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
              {loading ? (
                <p className="py-8 text-center text-sm text-gray-500">Loading...</p>
              ) : applications.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">No applications</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead>Specializations</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Applied</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {applications.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell className="font-medium">
                          {app.user?.name ?? app.user?.email ?? app.userId.slice(0, 8)}
                        </TableCell>
                        <TableCell>{app.region}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {app.specializations?.map((s) => (
                              <Badge key={s} variant="default">
                                {s}
                              </Badge>
                            )) ?? "—"}
                          </div>
                        </TableCell>
                        <TableCell>{app.tier}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_BADGE[app.applicationStatus] ?? "outline"}>
                            {app.applicationStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-500">
                          {new Date(app.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {app.applicationStatus === "SUBMITTED" && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedApp(app);
                                  setReviewAction("APPROVED");
                                  setDialogOpen(true);
                                }}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setSelectedApp(app);
                                  setReviewAction("REJECTED");
                                  setDialogOpen(true);
                                }}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
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
              {reviewAction === "APPROVED" ? "Approve" : "Reject"} Application
            </DialogTitle>
          </DialogHeader>
          {reviewAction === "REJECTED" && (
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
              variant={reviewAction === "APPROVED" ? "primary" : "destructive"}
              onClick={handleReview}
              disabled={submitting}
            >
              {submitting ? "Submitting..." : reviewAction === "APPROVED" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
