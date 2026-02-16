import { NextResponse } from "next/server";

// Static import map — pull rate JSON files served from public/data/pull-rates/
// These are pre-computed by the research pipeline and copied at build time.
const PULL_RATE_FILES: Record<string, () => Promise<unknown>> = {
  "OP01-EN": () => import("@/../public/data/pull-rates/pullrates-OP01-EN.json"),
  "OP02-EN": () => import("@/../public/data/pull-rates/pullrates-OP02-EN.json"),
  "OP03-EN": () => import("@/../public/data/pull-rates/pullrates-OP03-EN.json"),
  "OP04-EN": () => import("@/../public/data/pull-rates/pullrates-OP04-EN.json"),
  "OP05-EN": () => import("@/../public/data/pull-rates/pullrates-OP05-EN.json"),
  "OP06-EN": () => import("@/../public/data/pull-rates/pullrates-OP06-EN.json"),
  "OP07-EN": () => import("@/../public/data/pull-rates/pullrates-OP07-EN.json"),
  "OP08-EN": () => import("@/../public/data/pull-rates/pullrates-OP08-EN.json"),
  "OP09-EN": () => import("@/../public/data/pull-rates/pullrates-OP09-EN.json"),
  "OP10-EN": () => import("@/../public/data/pull-rates/pullrates-OP10-EN.json"),
  "OP11-EN": () => import("@/../public/data/pull-rates/pullrates-OP11-EN.json"),
  "OP12-EN": () => import("@/../public/data/pull-rates/pullrates-OP12-EN.json"),
  "OP13-EN": () => import("@/../public/data/pull-rates/pullrates-OP13-EN.json"),
  "OP14-EN": () => import("@/../public/data/pull-rates/pullrates-OP14-EN.json"),
};

// GET /api/pull-rates/[setCode] — Serve pre-computed pull rate data
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ setCode: string }> },
) {
  const { setCode } = await params;
  const code = setCode.toUpperCase();
  const key = `${code}-EN`;
  const loader = PULL_RATE_FILES[key];

  if (!loader) {
    return NextResponse.json(
      { error: `No pull rate data for set ${code}` },
      { status: 404 },
    );
  }

  try {
    const module = await loader() as { default: unknown };
    return NextResponse.json(module.default, {
      headers: { "Cache-Control": "public, max-age=86400" },
    });
  } catch {
    return NextResponse.json(
      { error: `Failed to load pull rate data for ${code}` },
      { status: 500 },
    );
  }
}
