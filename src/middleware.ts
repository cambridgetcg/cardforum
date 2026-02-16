import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimitSync, AUTH_RATE_LIMIT } from "@/lib/rate-limit";

const protectedPaths = [
  "/dashboard",
  "/listings",
  "/trades",
  "/collection",
  "/packs",
  "/settings",
  "/wallet",
  "/authenticator",
  "/digitisation",
  "/digital-tokens",
  "/digital-marketplace",
  "/digitiser",
  "/redemptions",
  "/kyc",
  "/marketplace",
  "/admin",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rate-limit credentials sign-in (POST to NextAuth callback)
  if (
    req.method === "POST" &&
    pathname.startsWith("/api/auth/callback/credentials")
  ) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rl = checkRateLimitSync(`login:${ip}`, AUTH_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
      );
    }
  }

  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));

  // Check for Auth.js session token (JWT strategy stores it as a cookie)
  const token =
    req.cookies.get("authjs.session-token")?.value ??
    req.cookies.get("__Secure-authjs.session-token")?.value;

  if (isProtected && !token) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/listings/:path*",
    "/trades/:path*",
    "/collection/:path*",
    "/packs/:path*",
    "/settings/:path*",
    "/wallet/:path*",
    "/authenticator/:path*",
    "/digitisation/:path*",
    "/digital-tokens/:path*",
    "/digital-marketplace/:path*",
    "/digitiser/:path*",
    "/redemptions/:path*",
    "/kyc/:path*",
    "/marketplace/:path*",
    "/admin/:path*",
    "/api/auth/callback/credentials",
  ],
};
