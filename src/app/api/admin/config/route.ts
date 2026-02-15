import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  getConfig,
  setConfig,
  listConfigs,
  deleteConfig,
  type ConfigKey,
} from "@/server/services/config.service";

// GET /api/admin/config?category=fees — List all config values
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Add admin role check when RBAC is implemented
  // if (!session.user.roles?.includes("ADMIN")) {
  //   return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // }

  const category = req.nextUrl.searchParams.get("category") as Parameters<typeof listConfigs>[0];
  const key = req.nextUrl.searchParams.get("key") as ConfigKey | null;

  if (key) {
    const value = await getConfig(key);
    return NextResponse.json({ key, value });
  }

  const configs = await listConfigs(category ?? undefined);
  return NextResponse.json({ configs });
}

// PUT /api/admin/config — Set a config value
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Add admin role check when RBAC is implemented

  const body = await req.json();
  const { key, value } = body;

  if (!key || value === undefined) {
    return NextResponse.json(
      { error: "key and value are required" },
      { status: 400 },
    );
  }

  const result = await setConfig(key as ConfigKey, value, session.user.id);
  return NextResponse.json(result);
}

// DELETE /api/admin/config?key=... — Revert to default
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Add admin role check when RBAC is implemented

  const key = req.nextUrl.searchParams.get("key") as ConfigKey | null;
  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  await deleteConfig(key);
  return NextResponse.json({ success: true, message: `Reverted ${key} to default` });
}
