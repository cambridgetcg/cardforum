/**
 * Slab Verification Service — Cert-based verification for graded cards.
 *
 * v1: PSA cert lookup only. BGS/CGC/SGC will be added when API access is secured.
 *
 * Slab verification is fundamentally different from raw card authentication:
 *   - Raw: subjective condition assessment by authenticator
 *   - Graded: objective cert number lookup + slab integrity check
 */

import { db } from "@/lib/db";

/** Data returned from a grading company cert lookup. */
export interface CertLookupResult {
  found: boolean;
  cardName?: string;
  grade?: number;
  gradingCompany?: string;
  year?: string;
  setName?: string;
}

/** Result of a slab verification, stored in VerificationAssignment.result JSON. */
export interface SlabVerificationResult {
  isGraded: true;
  slabIntact: boolean;
  certVerified: boolean;
  certNumber: string;
  gradingCompany: string;
  certifiedGrade: number | null;
  gradeMatchesListing: boolean;
  cardMatchesListing: boolean;
  notes: string;
}

/**
 * Verify a graded card's cert number with the grading company.
 *
 * v1: PSA only. Returns cert data if found, null if not.
 */
export async function lookupPSACert(
  certNumber: string,
): Promise<CertLookupResult> {
  const url = `https://www.psacard.com/cert/${encodeURIComponent(certNumber)}`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "CardForum/1.0 (cert-verification)" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return { found: false };
    }

    const html = await response.text();

    // PSA cert pages contain structured data we can parse
    // If the page contains "Cert #" and grade info, the cert is valid
    if (!html.includes("Cert #") && !html.includes("certification number")) {
      return { found: false };
    }

    // Extract grade from the page (PSA pages show "Grade: X" or "PSA X")
    const gradeMatch = html.match(/(?:Grade|PSA)\s*(\d{1,2})/i);
    const grade = gradeMatch ? parseInt(gradeMatch[1], 10) : undefined;

    // Extract card description
    const descMatch = html.match(/<title>([^<]+)<\/title>/);
    const cardName = descMatch ? descMatch[1].replace(/\s*-\s*PSA.*$/, "").trim() : undefined;

    return {
      found: true,
      cardName,
      grade,
      gradingCompany: "PSA",
    };
  } catch {
    // Network error, timeout, etc. — treat as unverifiable, not as invalid
    return { found: false };
  }
}

/**
 * Run full slab verification for a trade leg.
 *
 * 1. Load the graded listing from the trade leg
 * 2. Look up the cert with the grading company
 * 3. Cross-reference cert data with listing data
 * 4. Return verification result
 */
export async function verifySlabForTradeLeg(
  tradeLegId: string,
): Promise<SlabVerificationResult> {
  const leg = await db.tradeLeg.findUnique({
    where: { id: tradeLegId },
    include: {
      gradedHaveListing: {
        include: { card: { select: { name: true } } },
      },
    },
  });

  if (!leg?.gradedHaveListing) {
    return {
      isGraded: true,
      slabIntact: false,
      certVerified: false,
      certNumber: "",
      gradingCompany: "UNKNOWN",
      certifiedGrade: null,
      gradeMatchesListing: false,
      cardMatchesListing: false,
      notes: "Trade leg is not linked to a graded listing",
    };
  }

  const listing = leg.gradedHaveListing;

  // v1: PSA only
  if (listing.gradingCompany !== "PSA") {
    return {
      isGraded: true,
      slabIntact: true, // assume intact — manual check only
      certVerified: false,
      certNumber: listing.certNumber,
      gradingCompany: listing.gradingCompany,
      certifiedGrade: null,
      gradeMatchesListing: false,
      cardMatchesListing: false,
      notes: `Automated cert verification not yet supported for ${listing.gradingCompany}. Manual verification required.`,
    };
  }

  const certData = await lookupPSACert(listing.certNumber);

  if (!certData.found) {
    return {
      isGraded: true,
      slabIntact: true,
      certVerified: false,
      certNumber: listing.certNumber,
      gradingCompany: "PSA",
      certifiedGrade: null,
      gradeMatchesListing: false,
      cardMatchesListing: false,
      notes: "Cert number not found in PSA database",
    };
  }

  const gradeMatchesListing = certData.grade === listing.grade;
  const cardMatchesListing = certData.cardName
    ? listing.card.name.toLowerCase().includes(certData.cardName.toLowerCase()) ||
      certData.cardName.toLowerCase().includes(listing.card.name.toLowerCase())
    : false;

  const allVerified = gradeMatchesListing && cardMatchesListing;

  return {
    isGraded: true,
    slabIntact: true, // physical inspection still done by authenticator
    certVerified: true,
    certNumber: listing.certNumber,
    gradingCompany: "PSA",
    certifiedGrade: certData.grade ?? null,
    gradeMatchesListing,
    cardMatchesListing,
    notes: allVerified
      ? "Cert verified: grade and card match listing"
      : `Cert found but mismatch: grade=${gradeMatchesListing ? "match" : "mismatch"}, card=${cardMatchesListing ? "match" : "mismatch"}`,
  };
}
