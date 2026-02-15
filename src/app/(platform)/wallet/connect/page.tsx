"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { CheckCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

function ConnectContent() {
  const searchParams = useSearchParams();
  const onboarding = searchParams.get("onboarding");
  const refresh = searchParams.get("refresh");
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (refresh === "true") {
      // The onboarding link expired — generate a fresh one and redirect back
      setRedirecting(true);
      fetch("/api/connect/onboard", { method: "POST" })
        .then((res) => res.json())
        .then((data) => {
          if (data.url) {
            window.location.href = data.url;
          } else {
            setRedirecting(false);
          }
        })
        .catch(() => setRedirecting(false));
    }
  }, [refresh]);

  if (redirecting) {
    return (
      <div className="flex items-center gap-3 text-gray-500">
        <RefreshCw className="h-5 w-5 animate-spin" />
        <p>Refreshing onboarding link...</p>
      </div>
    );
  }

  if (onboarding === "complete") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-8 w-8 text-green-600" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Onboarding Complete</h2>
            <p className="text-sm text-gray-600">
              Your bank account has been connected. Withdrawals will now be sent automatically.
            </p>
          </div>
        </div>
        <Link href="/wallet">
          <Button>Back to Wallet</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Something went wrong with the onboarding process.
      </p>
      <Link href="/wallet">
        <Button variant="outline">Back to Wallet</Button>
      </Link>
    </div>
  );
}

export default function ConnectPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Bank Account Setup</h1>
      <Suspense fallback={<p className="text-gray-500">Loading...</p>}>
        <ConnectContent />
      </Suspense>
    </div>
  );
}
