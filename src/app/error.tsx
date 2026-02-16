"use client";

import { useEffect } from "react";

/**
 * Global error boundary — catches unhandled errors in the app.
 *
 * Agent pattern: When this page renders, it means something broke.
 * Check the console error for the root cause. Common triggers:
 *   - Prisma client not generated (run: npx prisma generate)
 *   - Missing env var (check .env against .env.example)
 *   - Database unreachable (check DATABASE_URL)
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console (Sentry integration point)
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold text-gray-900">Something went wrong</h1>
        <p className="mt-2 text-gray-600">An unexpected error occurred. Please try again.</p>
        {error.digest && <p className="mt-1 text-xs text-gray-400">Error ID: {error.digest}</p>}
        <button
          onClick={reset}
          className="mt-6 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
