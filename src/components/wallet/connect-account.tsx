"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, ExternalLink, Link2 } from "lucide-react";

interface ConnectAccountProps {
  hasConnectAccount: boolean;
  onboardingComplete: boolean;
}

export function ConnectAccount({ hasConnectAccount, onboardingComplete }: ConnectAccountProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleOnboard() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/connect/onboard", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to start onboarding");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Failed to start onboarding");
    } finally {
      setLoading(false);
    }
  }

  async function handleDashboard() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/connect/dashboard", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to open dashboard");
        return;
      }
      window.open(data.url, "_blank");
    } catch {
      setError("Failed to open dashboard");
    } finally {
      setLoading(false);
    }
  }

  // Connected + onboarding complete
  if (onboardingComplete) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <h3 className="text-sm font-semibold text-green-900">Bank Account Connected</h3>
        </div>
        <p className="mt-2 text-sm text-green-700">
          Withdrawals are automatically sent to your bank account.
        </p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={handleDashboard}
          disabled={loading}
        >
          <ExternalLink className="mr-1 h-3 w-3" />
          Manage Payout Settings
        </Button>
      </div>
    );
  }

  // Account exists but onboarding incomplete, or no account at all
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <Link2 className="h-5 w-5 text-amber-600" />
        <h3 className="text-sm font-semibold text-amber-900">
          {hasConnectAccount ? "Complete Onboarding" : "Connect Bank Account"}
        </h3>
      </div>
      <p className="mt-2 text-sm text-amber-700">
        {hasConnectAccount
          ? "Finish setting up your account to enable automatic payouts."
          : "Connect your bank account to receive automatic payouts when you withdraw."}
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <Button
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={handleOnboard}
        disabled={loading}
      >
        <Link2 className="mr-1 h-3 w-3" />
        {loading
          ? "Redirecting..."
          : hasConnectAccount
            ? "Complete Onboarding"
            : "Connect Bank Account"}
      </Button>
    </div>
  );
}
