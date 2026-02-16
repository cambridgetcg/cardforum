"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface ConfigEntry {
  key: string;
  value: string | number | boolean;
  isDefault?: boolean;
}

interface AuditEntry {
  id: string;
  key: string;
  oldValue: string | null;
  newValue: string;
  changedById: string;
  createdAt: string;
  changedBy?: { name: string | null; email: string };
}

export default function AdminConfigPage() {
  const [tab, setTab] = useState("config");
  const [configs, setConfigs] = useState<ConfigEntry[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editKey, setEditKey] = useState("");
  const [editValue, setEditValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchConfigs = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/config");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setConfigs(data.configs ?? []);
    } catch {
      setError("Failed to load configs");
    } finally {
      setLoading(false);
    }
  };

  const fetchAudit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/config/audit?limit=50");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setAuditEntries(data.entries ?? []);
    } catch {
      setError("Failed to load audit log");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "config") fetchConfigs();
    else fetchAudit();
  }, [tab]);

  const handleSave = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: editKey, value: editValue }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }
      setDialogOpen(false);
      fetchConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (key: string) => {
    try {
      const res = await fetch(`/api/admin/config?key=${encodeURIComponent(key)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to reset");
      fetchConfigs();
    } catch {
      setError("Failed to reset config");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Platform Config</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <Card>
            <CardHeader>
              <p className="text-sm text-gray-500">
                {configs.length} config value{configs.length !== 1 ? "s" : ""}
              </p>
            </CardHeader>
            <CardContent>
              {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
              {loading ? (
                <p className="py-8 text-center text-sm text-gray-500">Loading...</p>
              ) : configs.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">No configs</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {configs.map((cfg) => (
                      <TableRow key={cfg.key}>
                        <TableCell className="font-mono text-xs">
                          {cfg.key}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {String(cfg.value)}
                          {cfg.isDefault && (
                            <span className="ml-2 text-gray-400">(default)</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditKey(cfg.key);
                                setEditValue(String(cfg.value));
                                setDialogOpen(true);
                              }}
                            >
                              Edit
                            </Button>
                            {!cfg.isDefault && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleReset(cfg.key)}
                              >
                                Reset
                              </Button>
                            )}
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

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <p className="text-sm text-gray-500">Recent config changes</p>
            </CardHeader>
            <CardContent>
              {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
              {loading ? (
                <p className="py-8 text-center text-sm text-gray-500">Loading...</p>
              ) : auditEntries.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">No audit entries</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key</TableHead>
                      <TableHead>Old Value</TableHead>
                      <TableHead>New Value</TableHead>
                      <TableHead>Changed By</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-mono text-xs">
                          {entry.key}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-gray-500">
                          {entry.oldValue ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {entry.newValue}
                        </TableCell>
                        <TableCell>
                          {entry.changedBy?.name ?? entry.changedBy?.email ?? entry.changedById.slice(0, 8)}
                        </TableCell>
                        <TableCell className="text-gray-500">
                          {new Date(entry.createdAt).toLocaleString()}
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
            <DialogTitle>Edit Config</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Key
              </label>
              <Input value={editKey} disabled />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Value
              </label>
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
