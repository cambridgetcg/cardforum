/**
 * Bright Data Web Unlocker Client
 *
 * Uses the Bright Data REST API (api.brightdata.com/request) to fetch
 * web pages protected by anti-bot measures (Cloudflare, etc.).
 *
 * The proxy-based approach (brd.superproxy.io) does not reliably solve
 * Cloudflare JS challenges. The REST API handles this server-side.
 *
 * Credentials loaded from env or AWS Secrets Manager:
 *   Secret: brightdata/web-unlocker
 *   Keys: api_key, zone
 */

import type { FetchResult } from "./types";

interface BrightDataConfig {
  apiKey: string;
  zone: string;
}

const BRIGHTDATA_API_URL = "https://api.brightdata.com/request";

export class BrightDataClient {
  private config: BrightDataConfig;
  private requestCount = 0;

  constructor(config: BrightDataConfig) {
    this.config = config;
  }

  /**
   * Fetch a URL through Bright Data's Web Unlocker REST API.
   * Handles Cloudflare challenges server-side.
   */
  async fetch(url: string, options?: {
    format?: "html" | "json";
    country?: string;
    timeout?: number;
  }): Promise<FetchResult<string>> {
    const start = Date.now();
    const { format = "html", country, timeout = 120000 } = options ?? {};

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const body: Record<string, string> = {
        zone: this.config.zone,
        url,
        format: "raw",
      };
      if (country) {
        body.country = country;
      }

      const response = await fetch(BRIGHTDATA_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      this.requestCount++;

      const text = await response.text();

      // Detect Cloudflare waiting room / challenge pages
      const isBlocked =
        text.includes("Waiting Room powered by Cloudflare") ||
        text.includes("Just a moment...") ||
        (response.status === 403 && text.includes("cf-mitigated"));

      return {
        success: response.ok && !isBlocked,
        data: text,
        source: "brightdata",
        url,
        fetchedAt: new Date().toISOString(),
        durationMs: Date.now() - start,
        ...(isBlocked ? { error: "Cloudflare challenge not solved" } : {}),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        source: "brightdata",
        url,
        fetchedAt: new Date().toISOString(),
        durationMs: Date.now() - start,
      };
    }
  }

  /**
   * Fetch a URL and parse JSON response.
   */
  async fetchJson<T = unknown>(url: string, options?: {
    country?: string;
    timeout?: number;
  }): Promise<FetchResult<T>> {
    const result = await this.fetch(url, { ...options, format: "json" });
    if (!result.success || !result.data) {
      return { ...result, data: undefined } as FetchResult<T>;
    }

    try {
      const parsed = JSON.parse(result.data) as T;
      return { ...result, data: parsed };
    } catch {
      return {
        ...result,
        success: false,
        error: "Failed to parse JSON response",
        data: undefined,
      } as FetchResult<T>;
    }
  }

  /**
   * Direct API call without proxy — for public APIs that don't need
   * anti-bot bypassing (e.g., pokemontcg.io, scryfall.com/api).
   */
  async fetchDirect<T = unknown>(url: string, options?: {
    headers?: Record<string, string>;
    timeout?: number;
  }): Promise<FetchResult<T>> {
    const start = Date.now();
    const { headers = {}, timeout = 15000 } = options ?? {};

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        headers: {
          "User-Agent": "CardForum-Research/1.0",
          Accept: "application/json",
          ...headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const body = await response.text();
      let data: T | undefined;
      try {
        data = JSON.parse(body) as T;
      } catch {
        data = body as unknown as T;
      }

      return {
        success: response.ok,
        data,
        source: "direct",
        url,
        fetchedAt: new Date().toISOString(),
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        source: "direct",
        url,
        fetchedAt: new Date().toISOString(),
        durationMs: Date.now() - start,
      };
    }
  }

  get stats() {
    return { requestCount: this.requestCount };
  }
}

/**
 * Load Bright Data config from environment or AWS Secrets Manager.
 */
export async function loadBrightDataConfig(): Promise<BrightDataConfig> {
  // Try environment first
  if (process.env.BRIGHTDATA_API_KEY && process.env.BRIGHTDATA_ZONE) {
    return {
      apiKey: process.env.BRIGHTDATA_API_KEY,
      zone: process.env.BRIGHTDATA_ZONE,
    };
  }

  // Fall back to AWS Secrets Manager
  try {
    const { SecretsManagerClient, GetSecretValueCommand } = await import(
      "@aws-sdk/client-secrets-manager"
    );
    const client = new SecretsManagerClient({ region: "us-east-1" });
    const result = await client.send(
      new GetSecretValueCommand({ SecretId: "brightdata/web-unlocker" })
    );
    const secret = JSON.parse(result.SecretString ?? "{}");
    return {
      apiKey: secret.api_key,
      zone: secret.zone,
    };
  } catch (error) {
    throw new Error(
      `Failed to load Bright Data config: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
