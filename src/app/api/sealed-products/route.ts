import { NextResponse, type NextRequest } from "next/server";
import { searchSealedProducts } from "@/server/services/sealed-product.service";

// GET /api/sealed-products?q=&tcg=ONEPIECE&type=BOOSTER_BOX&page=1&limit=20
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const query = searchParams.get("q") ?? undefined;
  const tcg = searchParams.get("tcg") ?? undefined;
  const productType = searchParams.get("type") ?? undefined;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 20)));

  const result = await searchSealedProducts(query, tcg, productType, page, limit);
  return NextResponse.json(result);
}
