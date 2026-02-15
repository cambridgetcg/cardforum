/**
 * RBAC Foundation — Role-based access control for API routes.
 *
 * Phase 1: Role definitions, permission types, and `withRole()` middleware wrapper.
 * Phase 2: Role stored on User model, admin panel for role management.
 *
 * Integrates with the existing `withAuth()` middleware:
 *   export const GET = withRole("ADMIN")(async (req, { userId, role }) => { ... });
 *
 * Until roles are stored in DB, derives role from:
 *   - Authenticator? → AUTHENTICATOR
 *   - Admin email list → ADMIN
 *   - Default → USER
 */

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// ─── Roles & Permissions ─────────────────────────────

export const Role = {
  USER: "USER",
  AUTHENTICATOR: "AUTHENTICATOR",
  ADMIN: "ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

/** Role hierarchy — higher roles inherit lower role permissions */
const ROLE_HIERARCHY: Record<Role, number> = {
  USER: 0,
  AUTHENTICATOR: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

export const Permission = {
  // Listings
  LISTING_CREATE: "listing:create",
  LISTING_DELETE_OWN: "listing:delete:own",
  LISTING_DELETE_ANY: "listing:delete:any",

  // Trades
  TRADE_VIEW_OWN: "trade:view:own",
  TRADE_VIEW_ANY: "trade:view:any",
  TRADE_ACTION_OWN: "trade:action:own",

  // Verification
  VERIFY_CARD: "verify:card",
  VERIFY_ASSIGN: "verify:assign",

  // Admin
  ADMIN_CONFIG: "admin:config",
  ADMIN_USERS: "admin:users",
  ADMIN_KYC_REVIEW: "admin:kyc:review",
  ADMIN_DISPUTE_RESOLVE: "admin:dispute:resolve",
  ADMIN_AUTHENTICATOR_REVIEW: "admin:authenticator:review",

  // Wallet
  WALLET_MANAGE_OWN: "wallet:manage:own",
  WALLET_FREEZE_ANY: "wallet:freeze:any",
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

/** Default permissions per role */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  USER: [
    "listing:create",
    "listing:delete:own",
    "trade:view:own",
    "trade:action:own",
    "wallet:manage:own",
  ],
  AUTHENTICATOR: [
    "listing:create",
    "listing:delete:own",
    "trade:view:own",
    "trade:action:own",
    "wallet:manage:own",
    "verify:card",
  ],
  ADMIN: [
    "listing:create",
    "listing:delete:own",
    "listing:delete:any",
    "trade:view:own",
    "trade:view:any",
    "trade:action:own",
    "wallet:manage:own",
    "wallet:freeze:any",
    "verify:card",
    "verify:assign",
    "admin:config",
    "admin:users",
    "admin:kyc:review",
    "admin:dispute:resolve",
    "admin:authenticator:review",
  ],
  SUPER_ADMIN: Object.values(Permission),
};

// ─── Role Resolution ─────────────────────────────────

/** Admin email allowlist — env-based until DB roles exist */
function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw.split(",").map((e) => e.trim()).filter(Boolean);
}

/**
 * Derive a user's effective role from DB state.
 * Priority: admin emails → authenticator → user
 */
export async function resolveRole(userId: string): Promise<Role> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user) return "USER";

  // Check admin email list
  if (getAdminEmails().includes(user.email)) return "ADMIN";

  // Check if user is an active authenticator
  const authenticator = await db.authenticator.findUnique({
    where: { userId },
    select: { applicationStatus: true },
  });

  if (authenticator?.applicationStatus === "ACTIVE") return "AUTHENTICATOR";

  return "USER";
}

// ─── Permission Checks ──────────────────────────────

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasRole(actual: Role, required: Role): boolean {
  return ROLE_HIERARCHY[actual] >= ROLE_HIERARCHY[required];
}

// ─── Auth Context (Extended) ─────────────────────────

export interface RBACContext {
  userId: string;
  role: Role;
}

type RBACHandler = (
  req: NextRequest,
  ctx: RBACContext,
) => Promise<NextResponse | Response>;

// ─── Middleware Wrapper ──────────────────────────────

/**
 * Route handler wrapper that requires a minimum role.
 *
 * Usage:
 *   export const GET = withRole("ADMIN")(async (req, { userId, role }) => {
 *     // Only accessible by ADMIN or SUPER_ADMIN
 *     return NextResponse.json({ admin: true });
 *   });
 */
export function withRole(
  requiredRole: Role,
): (handler: RBACHandler) => (req: NextRequest) => Promise<NextResponse | Response> {
  return (handler) => async (req) => {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = await resolveRole(session.user.id);
    if (!hasRole(role, requiredRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return handler(req, { userId: session.user.id, role });
  };
}

/**
 * Route handler wrapper that requires a specific permission.
 *
 * Usage:
 *   export const POST = withPermission("admin:config")(async (req, { userId }) => { ... });
 */
export function withPermission(
  requiredPermission: Permission,
): (handler: RBACHandler) => (req: NextRequest) => Promise<NextResponse | Response> {
  return (handler) => async (req) => {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = await resolveRole(session.user.id);
    if (!hasPermission(role, requiredPermission)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return handler(req, { userId: session.user.id, role });
  };
}
