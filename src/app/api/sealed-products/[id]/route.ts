import { NextResponse } from "next/server";
import { getSealedProduct } from "@/server/services/sealed-product.service";

// GET /api/sealed-products/:id
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getSealedProduct(id);

  if (!product) {
    return NextResponse.json({ error: "Sealed product not found" }, { status: 404 });
  }

  return NextResponse.json(product);
}
