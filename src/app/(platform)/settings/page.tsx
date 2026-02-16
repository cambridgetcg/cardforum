"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RegionSelect } from "@/components/ui/region-select";

interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  region: string | null;
  regionId: string | null;
  country: string | null;
  bio: string | null;
  emailVerified: string | null;
  createdAt: string;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [regionId, setRegionId] = useState("");
  const [bio, setBio] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);

  useEffect(() => {
    fetch("/api/users/me")
      .then((r) => r.json())
      .then((data) => {
        setProfile(data);
        setName(data.name ?? "");
        setRegion(data.region ?? "");
        setRegionId(data.regionId ?? "");
        setBio(data.bio ?? "");
      })
      .catch(() => setError("Failed to load profile"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || undefined,
          region: region || undefined,
          regionId: regionId || undefined,
          bio: bio || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(typeof data.error === "string" ? data.error : "Save failed");
        return;
      }

      const updated = await res.json();
      setProfile(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-40 rounded bg-gray-200" />
          <div className="h-64 rounded bg-gray-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      <p className="mt-1 text-sm text-gray-600">Manage your account and preferences</p>

      <div className="mt-8 space-y-6">
        {/* Account Info (read-only) */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Account</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Email</span>
                <span className="font-medium text-gray-900">{profile?.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Email Verified</span>
                <div className="flex items-center gap-2">
                  {profile?.emailVerified ? (
                    <Badge variant="default">Verified</Badge>
                  ) : (
                    <>
                      <Badge variant="default">Not verified</Badge>
                      <button
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-50"
                        disabled={sendingVerification || verificationSent}
                        onClick={async () => {
                          setSendingVerification(true);
                          try {
                            await fetch("/api/auth/resend-verification", { method: "POST" });
                            setVerificationSent(true);
                          } catch {
                            /* ignore */
                          }
                          setSendingVerification(false);
                        }}
                      >
                        {verificationSent ? "Sent!" : sendingVerification ? "Sending..." : "Resend"}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Member Since</span>
                <span className="text-gray-900">
                  {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "—"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Editable Profile */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
              {success && (
                <p className="rounded-lg bg-green-50 p-3 text-sm text-green-600">
                  Profile saved successfully
                </p>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">Display Name</label>
                <Input
                  className="mt-1"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Region</label>
                <div className="mt-1">
                  <RegionSelect
                    value={regionId}
                    onChange={(id, displayName) => {
                      setRegionId(id);
                      setRegion(displayName);
                    }}
                    placeholder="Select your region..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Bio</label>
                <Input
                  className="mt-1"
                  placeholder="Tell other traders about yourself"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={500}
                />
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
