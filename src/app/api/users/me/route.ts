import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateProfileSchema } from "@/lib/validators";

// GET /api/users/me — Current user profile
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      region: true,
      regionId: true,
      country: true,
      bio: true,
      emailVerified: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

// PATCH /api/users/me — Update profile
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // Only include fields that were actually provided
  const data: Record<string, string | null> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.region !== undefined) data.region = parsed.data.region;
  if (parsed.data.regionId !== undefined) data.regionId = parsed.data.regionId;
  if (parsed.data.country !== undefined) data.country = parsed.data.country;
  if (parsed.data.bio !== undefined) data.bio = parsed.data.bio;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const user = await db.user.update({
    where: { id: session.user.id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      region: true,
      regionId: true,
      country: true,
      bio: true,
      emailVerified: true,
      createdAt: true,
    },
  });

  return NextResponse.json(user);
}
