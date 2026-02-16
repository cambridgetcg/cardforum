/**
 * Shared TCGCSV API Client
 *
 * TCGCSV (tcgcsv.com) provides a free, public, unauthenticated JSON API
 * that proxies TCGPlayer's catalog + pricing data, refreshed daily.
 *
 * This module extracts the fetch functions used by both:
 *   - trends-fetch-prices.ts (price snapshots for trend analysis)
 *   - refresh-prices.ts (DB price updates)
 */

import type { TcgcsvResponse, TcgcsvProduct, TcgcsvPrice } from "./tcgplayer-types";
import { TCGCSV_BASE_URL } from "./tcgplayer-types";

/**
 * Fetch all products for a TCGCSV group (set).
 */
export async function fetchProductsFromTcgcsv(
  categoryId: number,
  groupId: number,
): Promise<TcgcsvProduct[]> {
  const url = `${TCGCSV_BASE_URL}/tcgplayer/${categoryId}/${groupId}/products`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TCGCSV products error: ${res.status} ${res.statusText}`);
  }
  const data: TcgcsvResponse<TcgcsvProduct> = await res.json();
  if (!data.success) {
    throw new Error(`TCGCSV products API error: ${data.errors.join(", ")}`);
  }
  return data.results;
}

/**
 * Fetch all prices for a TCGCSV group (set).
 */
export async function fetchPricesFromTcgcsv(
  categoryId: number,
  groupId: number,
): Promise<TcgcsvPrice[]> {
  const url = `${TCGCSV_BASE_URL}/tcgplayer/${categoryId}/${groupId}/prices`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TCGCSV prices error: ${res.status} ${res.statusText}`);
  }
  const data: TcgcsvResponse<TcgcsvPrice> = await res.json();
  if (!data.success) {
    throw new Error(`TCGCSV prices API error: ${data.errors.join(", ")}`);
  }
  return data.results;
}
