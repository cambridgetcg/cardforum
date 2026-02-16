"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

// ─── Types ──────────────────────────────────────────────

interface CalibrationReport {
  id: string;
  sampleSize: number;
  agreementRate: number;
  confidenceLevel: string;
  biasSurface: number;
  biasCorners: number;
  biasEdges: number;
  biasCentering: number;
  biasComposite: number;
  madSurface: number;
  madCorners: number;
  madEdges: number;
  madCentering: number;
  madComposite: number;
  driftDetected: boolean;
  driftDimensions: string[];
  driftDetails: Record<string, { recentBias: number; baselineBias: number; delta: number }> | null;
  perTcgBreakdown: Record<string, { count: number; agreementRate: number; biasComposite: number; madComposite: number }> | null;
  outlierAuthenticators: Array<{
    authenticatorId: string;
    name: string;
    tier: string;
    comparisons: number;
    agreementRate: number;
    avgDeltaComposite: number;
    biasComposite: number;
  }> | null;
  suggestedWeights: Record<string, number> | null;
  currentWeights: Record<string, number>;
  status: string;
  appliedAt: string | null;
  appliedBy: string | null;
  createdAt: string;
}

interface AuthenticatorStat {
  authenticatorId: string;
  name: string;
  tier: string;
  comparisons: number;
  agreementRate: number;
  avgDeltaComposite: number;
  biasComposite: number;
  isOutlier: boolean;
}

interface HistoryEntry {
  id: string;
  sampleSize: number;
  agreementRate: number;
  confidenceLevel: string;
  driftDetected: boolean;
  driftDimensions: string[];
  status: string;
  createdAt: string;
}

// ─── Component ──────────────────────────────────────────

export default function CalibrationPage() {
  const [tab, setTab] = useState("overview");
  const [report, setReport] = useState<CalibrationReport | null>(null);
  const [authenticators, setAuthenticators] = useState<AuthenticatorStat[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<"apply" | "dismiss" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    const res = await fetch("/api/admin/calibration");
    const data = await res.json();
    setReport(data.report ?? null);
  }, []);

  const fetchAuthenticators = useCallback(async () => {
    const res = await fetch("/api/admin/calibration/authenticators");
    const data = await res.json();
    setAuthenticators(data.authenticators ?? []);
  }, []);

  const fetchHistory = useCallback(async () => {
    const res = await fetch("/api/admin/calibration/history");
    const data = await res.json();
    setHistory(data.reports ?? []);
    setHistoryTotal(data.total ?? 0);
  }, []);

  useEffect(() => {
    Promise.all([fetchReport(), fetchAuthenticators(), fetchHistory()]).finally(() =>
      setLoading(false),
    );
  }, [fetchReport, fetchAuthenticators, fetchHistory]);

  async function handleRunCalibration() {
    setRunning(true);
    try {
      const res = await fetch("/api/admin/calibration", { method: "POST" });
      const data = await res.json();
      if (data.report) {
        await Promise.all([fetchReport(), fetchHistory()]);
      } else {
        alert(data.message ?? "Calibration produced no report");
      }
    } catch {
      alert("Calibration failed");
    } finally {
      setRunning(false);
    }
  }

  async function handleApply() {
    if (!report) return;
    setActionLoading(true);
    try {
      await fetch("/api/admin/calibration/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: report.id }),
      });
      await Promise.all([fetchReport(), fetchHistory()]);
    } catch {
      alert("Failed to apply weights");
    } finally {
      setActionLoading(false);
      setConfirmDialog(null);
    }
  }

  async function handleDismiss() {
    if (!report) return;
    setActionLoading(true);
    try {
      await fetch("/api/admin/calibration/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: report.id }),
      });
      await Promise.all([fetchReport(), fetchHistory()]);
    } catch {
      alert("Failed to dismiss report");
    } finally {
      setActionLoading(false);
      setConfirmDialog(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-gray-500">Loading calibration data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CCS Calibration</h1>
          <p className="mt-1 text-sm text-gray-500">
            AI vs Authenticator condition scoring drift detection and weight tuning
          </p>
        </div>
        <button
          onClick={handleRunCalibration}
          disabled={running}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {running ? "Running..." : "Run Calibration Now"}
        </button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="authenticators">Authenticators</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* ─── Overview Tab ─────────────────────────────── */}
        <TabsContent value="overview">
          {!report ? (
            <EmptyState message="No calibration reports yet. Run a calibration to generate the first report." />
          ) : (
            <div className="space-y-6">
              {/* Accuracy Card */}
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  AI Accuracy
                </h2>
                <div className="mt-4 flex items-baseline gap-4">
                  <span className="text-3xl font-bold text-gray-900">
                    {(report.agreementRate * 100).toFixed(1)}%
                  </span>
                  <Badge variant={report.agreementRate >= 0.8 ? "success" : report.agreementRate >= 0.6 ? "warning" : "error"}>
                    {report.agreementRate >= 0.8 ? "Good" : report.agreementRate >= 0.6 ? "Fair" : "Poor"}
                  </Badge>
                  <Badge variant={report.confidenceLevel === "HIGH" ? "success" : report.confidenceLevel === "MODERATE" ? "warning" : "error"}>
                    {report.confidenceLevel} confidence
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  {report.sampleSize} comparisons in the last 30 days
                </p>
                <Badge variant={report.status === "GENERATED" ? "info" : report.status === "WEIGHTS_APPLIED" ? "success" : "default"}>
                  {report.status}
                </Badge>
              </div>

              {/* Per-Dimension Bias */}
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  Per-Dimension Bias (AI - Authenticator)
                </h2>
                <p className="mt-1 text-xs text-gray-400">
                  Positive = AI grades higher. Negative = AI grades lower.
                </p>
                <div className="mt-4 space-y-3">
                  {(["surface", "corners", "edges", "centering", "composite"] as const).map((dim) => {
                    const biasKey = `bias${dim.charAt(0).toUpperCase()}${dim.slice(1)}` as keyof CalibrationReport;
                    const madKey = `mad${dim.charAt(0).toUpperCase()}${dim.slice(1)}` as keyof CalibrationReport;
                    const bias = report[biasKey] as number;
                    const mad = report[madKey] as number;
                    return (
                      <BiasBar key={dim} label={dim} bias={bias} mad={mad} />
                    );
                  })}
                </div>
              </div>

              {/* Drift Detection */}
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  Drift Detection
                </h2>
                <div className="mt-3 flex items-center gap-3">
                  <Badge variant={report.driftDetected ? "error" : "success"}>
                    {report.driftDetected ? "Drift Detected" : "No Drift"}
                  </Badge>
                  {report.driftDimensions.length > 0 && (
                    <span className="text-sm text-gray-600">
                      Affected: {report.driftDimensions.join(", ")}
                    </span>
                  )}
                </div>
                {report.driftDetails && Object.keys(report.driftDetails).length > 0 && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-gray-500">
                          <th className="pb-2 pr-4">Dimension</th>
                          <th className="pb-2 pr-4">Recent Bias</th>
                          <th className="pb-2 pr-4">Baseline Bias</th>
                          <th className="pb-2">Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(report.driftDetails).map(([dim, d]) => (
                          <tr key={dim} className="border-b border-gray-100">
                            <td className="py-2 pr-4 capitalize font-medium">{dim}</td>
                            <td className="py-2 pr-4">{d.recentBias.toFixed(3)}</td>
                            <td className="py-2 pr-4">{d.baselineBias.toFixed(3)}</td>
                            <td className="py-2">
                              <span className={d.delta > 0.5 ? "text-red-600 font-medium" : ""}>
                                {d.delta.toFixed(3)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Per-TCG Breakdown */}
              {report.perTcgBreakdown && Object.keys(report.perTcgBreakdown).length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white p-6">
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                    Per-TCG Breakdown
                  </h2>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-gray-500">
                          <th className="pb-2 pr-4">TCG</th>
                          <th className="pb-2 pr-4">Comparisons</th>
                          <th className="pb-2 pr-4">Agreement</th>
                          <th className="pb-2 pr-4">Bias</th>
                          <th className="pb-2">MAD</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(report.perTcgBreakdown).map(([tcg, data]) => (
                          <tr key={tcg} className="border-b border-gray-100">
                            <td className="py-2 pr-4 font-medium">{tcg}</td>
                            <td className="py-2 pr-4">{data.count}</td>
                            <td className="py-2 pr-4">{(data.agreementRate * 100).toFixed(1)}%</td>
                            <td className="py-2 pr-4">{data.biasComposite.toFixed(3)}</td>
                            <td className="py-2">{data.madComposite.toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Weight Suggestion */}
              {report.suggestedWeights && report.status === "GENERATED" && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
                  <h2 className="text-sm font-semibold text-amber-800 uppercase tracking-wider">
                    Suggested Weight Adjustment
                  </h2>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-gray-600">
                          <th className="pb-2 pr-4">Dimension</th>
                          <th className="pb-2 pr-4">Current</th>
                          <th className="pb-2 pr-4">Suggested</th>
                          <th className="pb-2">Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(["surface", "corners", "edges", "centering"] as const).map((dim) => {
                          const current = report.currentWeights[dim] ?? 0;
                          const suggested = report.suggestedWeights![dim] ?? 0;
                          const diff = suggested - current;
                          return (
                            <tr key={dim} className="border-b border-amber-100">
                              <td className="py-2 pr-4 capitalize font-medium">{dim}</td>
                              <td className="py-2 pr-4">{(current * 100).toFixed(1)}%</td>
                              <td className="py-2 pr-4">{(suggested * 100).toFixed(1)}%</td>
                              <td className="py-2">
                                <span className={diff < 0 ? "text-red-600" : diff > 0 ? "text-green-600" : ""}>
                                  {diff >= 0 ? "+" : ""}{(diff * 100).toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => setConfirmDialog("apply")}
                      className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                    >
                      Apply Weights
                    </button>
                    <button
                      onClick={() => setConfirmDialog("dismiss")}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ─── Authenticators Tab ──────────────────────── */}
        <TabsContent value="authenticators">
          {authenticators.length === 0 ? (
            <EmptyState message="No authenticator calibration data available yet." />
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="px-4 py-3">Authenticator</th>
                      <th className="px-4 py-3">Tier</th>
                      <th className="px-4 py-3">Comparisons</th>
                      <th className="px-4 py-3">Agreement</th>
                      <th className="px-4 py-3">Avg Delta</th>
                      <th className="px-4 py-3">Bias</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {authenticators.map((a) => (
                      <tr key={a.authenticatorId} className="border-b border-gray-100">
                        <td className="px-4 py-3 font-medium">{a.name}</td>
                        <td className="px-4 py-3">
                          <Badge variant={a.tier === "PREMIUM" ? "success" : a.tier === "VERIFIED" ? "info" : "default"}>
                            {a.tier}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">{a.comparisons}</td>
                        <td className="px-4 py-3">{(a.agreementRate * 100).toFixed(1)}%</td>
                        <td className="px-4 py-3">{a.avgDeltaComposite.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span className={a.biasComposite > 0.3 ? "text-red-600" : a.biasComposite < -0.3 ? "text-blue-600" : ""}>
                            {a.biasComposite >= 0 ? "+" : ""}{a.biasComposite.toFixed(3)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={a.isOutlier ? "error" : "success"}>
                            {a.isOutlier ? "Outlier" : "Normal"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ─── History Tab ─────────────────────────────── */}
        <TabsContent value="history">
          {history.length === 0 ? (
            <EmptyState message="No calibration history yet." />
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Samples</th>
                      <th className="px-4 py-3">Agreement</th>
                      <th className="px-4 py-3">Drift</th>
                      <th className="px-4 py-3">Confidence</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id} className="border-b border-gray-100">
                        <td className="px-4 py-3">
                          {new Date(h.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3">{h.sampleSize}</td>
                        <td className="px-4 py-3">{(h.agreementRate * 100).toFixed(1)}%</td>
                        <td className="px-4 py-3">
                          <Badge variant={h.driftDetected ? "error" : "success"}>
                            {h.driftDetected ? "Yes" : "No"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={h.confidenceLevel === "HIGH" ? "success" : h.confidenceLevel === "MODERATE" ? "warning" : "error"}>
                            {h.confidenceLevel}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={h.status === "WEIGHTS_APPLIED" ? "success" : h.status === "DISMISSED" ? "default" : "info"}>
                            {h.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {historyTotal > history.length && (
                <div className="border-t px-4 py-3 text-center text-sm text-gray-500">
                  Showing {history.length} of {historyTotal} reports
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog !== null} onClose={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog === "apply" ? "Apply Weight Adjustment?" : "Dismiss Report?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            {confirmDialog === "apply"
              ? "This will update the CCS dimension weights used for all future condition scoring. This action is logged in the config audit trail."
              : "This will mark the report as dismissed. No weight changes will be made. You can still view the report in history."}
          </p>
          <DialogFooter>
            <button
              onClick={() => setConfirmDialog(null)}
              disabled={actionLoading}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={confirmDialog === "apply" ? handleApply : handleDismiss}
              disabled={actionLoading}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                confirmDialog === "apply"
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-gray-600 hover:bg-gray-700"
              }`}
            >
              {actionLoading ? "Processing..." : confirmDialog === "apply" ? "Apply" : "Dismiss"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────

function BiasBar({ label, bias, mad }: { label: string; bias: number; mad: number }) {
  // Scale: -3 to +3 mapped to 0-100%
  const maxRange = 3;
  const clampedBias = Math.max(-maxRange, Math.min(maxRange, bias));
  const percentage = ((clampedBias + maxRange) / (maxRange * 2)) * 100;
  const barWidth = Math.abs(clampedBias / maxRange) * 50;

  const isPositive = clampedBias >= 0;
  const absBias = Math.abs(bias);
  const barColor =
    absBias < 0.3 ? "bg-green-500" : absBias < 0.5 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="flex items-center gap-4">
      <span className="w-24 text-sm font-medium capitalize text-gray-700">{label}</span>
      <div className="relative flex-1 h-6 rounded bg-gray-100">
        {/* Center line */}
        <div className="absolute left-1/2 top-0 h-full w-px bg-gray-300" />
        {/* Bias bar */}
        <div
          className={`absolute top-1 h-4 rounded ${barColor}`}
          style={{
            left: isPositive ? "50%" : `${50 - barWidth}%`,
            width: `${barWidth}%`,
          }}
        />
      </div>
      <div className="w-32 text-right text-xs text-gray-500">
        <span className={absBias >= 0.3 ? "font-medium text-gray-900" : ""}>
          {bias >= 0 ? "+" : ""}{bias.toFixed(3)}
        </span>
        <span className="ml-2 text-gray-400">MAD {mad.toFixed(2)}</span>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-6 py-16 text-center">
      <p className="text-gray-500">{message}</p>
    </div>
  );
}
