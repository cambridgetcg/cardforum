"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!token || !email) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardContent className="pt-6">
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            Invalid reset link. Please request a new one.
          </p>
          <Link href="/forgot-password" className="mt-4 block">
            <Button variant="outline" className="w-full">
              Request New Link
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Reset failed");
        setLoading(false);
        return;
      }

      router.push("/login?reset=true");
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <h1 className="text-2xl font-bold text-gray-900">Set new password</h1>
        <p className="text-sm text-gray-600">Choose a new password for your account.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
          <div>
            <Input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <p className="mt-1 text-xs text-gray-500">
              Min 8 characters with uppercase, lowercase, and a number
            </p>
          </div>
          <Input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
          />
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Resetting..." : "Reset Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Suspense
        fallback={<div className="h-64 w-full max-w-md animate-pulse rounded bg-gray-100" />}
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
