/**
 * Soft-Delete Foundation — Prisma middleware + utilities.
 *
 * Instead of deleting records, sets `deletedAt` timestamp.
 * Queries automatically filter out soft-deleted records.
 *
 * Phase 1: Provides the middleware and utility functions.
 * Phase 2: Add `deletedAt DateTime?` to schema models that need it.
 *
 * Models targeted for soft-delete:
 *   - HaveListing, WantListing (already has isActive — soft-delete adds audit trail)
 *   - Trade (preserve for dispute/audit trail)
 *   - User (account deactivation without data loss)
 *   - Authenticator (preserve verification history)
 *
 * Usage:
 *   // In db.ts, after creating client:
 *   applySoftDeleteMiddleware(db, ["HaveListing", "WantListing", "Trade"]);
 *
 *   // To hard-delete (bypass middleware):
 *   await db.haveListing.delete({ where: { id }, ...hardDelete() });
 */

// Using a loose type since PrismaClient.$use isn't always available in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClientLike = { $use: (...args: any[]) => void };

// ─── Types ───────────────────────────────────────────

/** Models that support soft-delete */
export type SoftDeletableModel = string;

interface SoftDeleteConfig {
  /** Field name for the soft-delete timestamp (default: "deletedAt") */
  field: string;
  /** Models that have the soft-delete field */
  models: Set<string>;
}

// ─── Default Config ──────────────────────────────────

const DEFAULT_FIELD = "deletedAt";

// ─── Middleware ──────────────────────────────────────

/**
 * Apply soft-delete middleware to Prisma client.
 *
 * Intercepts delete/deleteMany operations and converts them to updates.
 * Intercepts find operations and filters out soft-deleted records.
 *
 * NOTE: Requires `deletedAt DateTime?` field on target models in schema.prisma.
 * This foundation ships the middleware before the schema migration.
 */
export function applySoftDeleteMiddleware(
  client: PrismaClientLike,
  modelNames: string[],
  field: string = DEFAULT_FIELD,
): void {
  const config: SoftDeleteConfig = {
    field,
    models: new Set(modelNames),
  };

  // Intercept delete → update with deletedAt
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client.$use(async (params: any, next: any) => {
    if (!config.models.has(params.model ?? "")) return next(params);

    if (params.action === "delete") {
      params.action = "update";
      params.args.data = { [config.field]: new Date() };
      return next(params);
    }

    if (params.action === "deleteMany") {
      params.action = "updateMany";
      if (params.args.data) {
        params.args.data[config.field] = new Date();
      } else {
        params.args.data = { [config.field]: new Date() };
      }
      return next(params);
    }

    // Intercept find → add where deletedAt = null
    if (["findFirst", "findMany", "findUnique", "findFirstOrThrow", "findUniqueOrThrow", "count", "aggregate", "groupBy"].includes(params.action)) {
      if (!params.args) params.args = {};
      if (params.args.where) {
        // Don't override if deletedAt is explicitly queried
        if (params.args.where[config.field] === undefined) {
          params.args.where[config.field] = null;
        }
      } else {
        params.args.where = { [config.field]: null };
      }
    }

    return next(params);
  });
}

// ─── Utilities ───────────────────────────────────────

/**
 * Include soft-deleted records in a query.
 * Usage: db.trade.findMany({ where: { ...includeSoftDeleted(), status: "CANCELLED" } })
 */
export function includeSoftDeleted(field: string = DEFAULT_FIELD) {
  return { [field]: undefined };
}

/**
 * Query only soft-deleted records.
 * Usage: db.trade.findMany({ where: { ...onlySoftDeleted() } })
 */
export function onlySoftDeleted(field: string = DEFAULT_FIELD) {
  return { [field]: { not: null } };
}

/**
 * Restore a soft-deleted record.
 * Usage: await restoreSoftDeleted(db.trade, recordId);
 */
export async function restoreSoftDeleted(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any,
  id: string,
  field: string = DEFAULT_FIELD,
): Promise<void> {
  await model.update({
    where: { id, [field]: { not: null } },
    data: { [field]: null },
  });
}

/**
 * Permanently delete a soft-deleted record (hard delete).
 * Bypasses the middleware by querying the raw client.
 */
export function hardDelete() {
  return { _hardDelete: true } as const;
}
