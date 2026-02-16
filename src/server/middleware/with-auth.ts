import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

// ─── Types ──────────────────────────────────────────────

export interface AuthContext {
  userId: string;
}

type AuthenticatedHandler = (
  req: NextRequest,
  ctx: AuthContext,
) => Promise<NextResponse | Response>;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface WithAuthOptions {
  // Future: roles?: UserRole[] — enforce role-based access
  // When RBAC lands, add:   roles?: ("USER" | "ADMIN" | "AUTHENTICATOR")[];
}

// ─── Wrapper ────────────────────────────────────────────

/**
 * Wraps a Next.js route handler with authentication.
 *
 * Eliminates the 5-line auth boilerplate from every API route:
 * ```
 * const session = await auth();
 * if (!session?.user?.id) {
 *   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 * }
 * ```
 *
 * Usage:
 * ```
 * export const GET = withAuth(async (req, { userId }) => {
 *   const data = await service.getData(userId);
 *   return NextResponse.json(data);
 * });
 * ```
 */
export function withAuth(
  handler: AuthenticatedHandler,
  _options?: WithAuthOptions,
): (req: NextRequest) => Promise<NextResponse | Response> {
  return async (req: NextRequest) => {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Future RBAC:
    // if (options?.roles && !options.roles.includes(session.user.role)) {
    //   return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // }

    return handler(req, { userId: session.user.id });
  };
}

/**
 * Wraps a Next.js route handler that takes route params (e.g. [tradeId]).
 *
 * Usage:
 * ```
 * export const GET = withAuthParams(async (req, { userId }, params) => {
 *   const { tradeId } = await params;
 *   return NextResponse.json(await getTrade(userId, tradeId));
 * });
 * ```
 */
export function withAuthParams<P extends Record<string, string>>(
  handler: (
    req: NextRequest,
    ctx: AuthContext,
    params: Promise<P>,
  ) => Promise<NextResponse | Response>,
  _options?: WithAuthOptions,
): (req: NextRequest, ctx: { params: Promise<P> }) => Promise<NextResponse | Response> {
  return async (req: NextRequest, { params }: { params: Promise<P> }) => {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return handler(req, { userId: session.user.id }, params);
  };
}
