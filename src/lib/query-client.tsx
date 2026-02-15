"use client";

/**
 * React Query Provider — Wraps the app with QueryClientProvider.
 *
 * Replaces ad-hoc useState+useEffect+fetch patterns with cached,
 * deduped, automatically-refreshed data fetching.
 *
 * Usage (in layout.tsx):
 *   import { QueryProvider } from "@/lib/query-client";
 *   <QueryProvider>{children}</QueryProvider>
 *
 * Usage (in components):
 *   import { useQuery } from "@tanstack/react-query";
 *   import { api } from "@/lib/api-client";
 *   const { data } = useQuery({ queryKey: ["wallet"], queryFn: api.wallet.getBalance });
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        refetchOnWindowFocus: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always create a new client
    return makeQueryClient();
  }
  // Browser: reuse singleton
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(getQueryClient);
  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  );
}
