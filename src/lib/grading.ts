/**
 * Grading utilities — grade validation, canonical normalization, and matching.
 *
 * v1: PSA-only. Cross-company normalization is scaffolded for future use.
 */

import type { GradingCompany } from "@/types/domain";

/** Valid PSA grades: integers 1–10. */
const PSA_GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Valid BGS/CGC grades: 1.0–10.0 in 0.5 increments. */
const HALF_POINT_GRADES = [
  1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5,
  10,
];

/**
 * Validate that a grade is valid for the given grading company.
 * PSA/SGC: integers 1–10. BGS/CGC: 0.5 increments 1.0–10.0.
 */
export function isValidGrade(
  grade: number,
  company: GradingCompany,
): boolean {
  if (company === "PSA" || company === "SGC") {
    return PSA_GRADES.includes(grade);
  }
  return HALF_POINT_GRADES.includes(grade);
}

/**
 * Normalize a grade to a canonical integer (1–10) for cross-company matching.
 *
 * PSA/SGC: already integers, pass through.
 * BGS/CGC 9.5: stays 9.5 (distinct tier, no PSA equivalent).
 * BGS/CGC other half-grades: round down (8.5 → 8, 7.5 → 7).
 */
export function canonicalGrade(
  grade: number,
  company: GradingCompany,
): number {
  if (company === "PSA" || company === "SGC") return grade;

  // BGS/CGC 9.5 is a distinct tier (Gem Mint)
  if (grade === 9.5) return 9.5;

  // Other half-grades round down to nearest integer
  return Math.floor(grade);
}

/**
 * Check whether a have listing's grade satisfies a want listing's criteria.
 *
 * - If the want specifies a grading company, it must match.
 * - The have's grade must be within [minGrade, maxGrade].
 * - If maxGrade is null, only exact minGrade matches.
 */
export function gradeMatchesWant(
  haveGrade: number,
  haveCompany: GradingCompany,
  wantMinGrade: number,
  wantMaxGrade: number | null,
  wantCompany: GradingCompany | null,
): boolean {
  // Company filter
  if (wantCompany != null && wantCompany !== haveCompany) return false;

  // Grade range check
  if (haveGrade < wantMinGrade) return false;
  if (wantMaxGrade != null && haveGrade > wantMaxGrade) return false;

  // If no maxGrade, require exact match on minGrade
  if (wantMaxGrade == null && haveGrade !== wantMinGrade) return false;

  return true;
}

/**
 * Validate a PSA cert number format.
 * PSA cert numbers are 8-digit numeric strings.
 */
export function isValidPSACertNumber(certNumber: string): boolean {
  return /^\d{7,10}$/.test(certNumber);
}

/**
 * Get the valid grades for a grading company, for use in UI selects.
 */
export function validGradesForCompany(company: GradingCompany): number[] {
  if (company === "PSA" || company === "SGC") return PSA_GRADES;
  return HALF_POINT_GRADES;
}
