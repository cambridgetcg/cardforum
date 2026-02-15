import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { shippingAddressSchema } from "@/lib/validators";

// GET /api/users/address — List current user's shipping addresses
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const addresses = await db.shippingAddress.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ addresses });
}

// POST /api/users/address — Create or update a shipping address
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = shippingAddressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const data = parsed.data;

  // If this is set as default, unset any existing default
  if (data.isDefault) {
    await db.shippingAddress.updateMany({
      where: { userId: session.user.id, isDefault: true },
      data: { isDefault: false },
    });
  }

  // If this is the first address, always set as default
  const existingCount = await db.shippingAddress.count({
    where: { userId: session.user.id },
  });

  const address = await db.shippingAddress.create({
    data: {
      ...data,
      userId: session.user.id,
      isDefault: data.isDefault || existingCount === 0,
    },
  });

  return NextResponse.json(address, { status: 201 });
}

// DELETE /api/users/address — Delete a shipping address
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const addressId = searchParams.get("id");
  if (!addressId) {
    return NextResponse.json({ error: "Address ID required" }, { status: 400 });
  }

  const address = await db.shippingAddress.findUnique({ where: { id: addressId } });
  if (!address || address.userId !== session.user.id) {
    return NextResponse.json({ error: "Address not found" }, { status: 404 });
  }

  // Check if address is locked to any active trade legs
  const activeLeg = await db.tradeLeg.findFirst({
    where: {
      shippingAddressId: addressId,
      trade: { status: { notIn: ["COMPLETED", "CANCELLED", "REJECTED"] } },
    },
  });

  if (activeLeg) {
    return NextResponse.json(
      { error: "Cannot delete address locked to an active trade" },
      { status: 409 },
    );
  }

  await db.shippingAddress.delete({ where: { id: addressId } });

  // If deleted the default, promote the most recent remaining address
  if (address.isDefault) {
    const next = await db.shippingAddress.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });
    if (next) {
      await db.shippingAddress.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
