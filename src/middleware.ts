import { NextResponse, type NextRequest } from "next/server";

const protectedPaths = [
  "/dashboard",
  "/listings",
  "/trades",
  "/settings",
  "/wallet",
  "/authenticator",
  "/digitisation",
  "/digital-tokens",
  "/digital-marketplace",
  "/digitiser",
  "/redemptions",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
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
    "/settings/:path*",
    "/wallet/:path*",
    "/authenticator/:path*",
    "/digitisation/:path*",
    "/digital-tokens/:path*",
    "/digital-marketplace/:path*",
    "/digitiser/:path*",
    "/redemptions/:path*",
  ],
};
