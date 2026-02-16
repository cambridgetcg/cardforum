import { db } from "@/lib/db";
import type { TCG, SealedProductType } from "@/generated/prisma/client";

/**
 * Search sealed products by name, TCG, and product type.
 */
export async function searchSealedProducts(
  query?: string,
  tcg?: string,
  productType?: string,
  page = 1,
  limit = 20,
) {
  const skip = (page - 1) * limit;

  const where = {
    ...(query && {
      OR: [
        { name: { contains: query, mode: "insensitive" as const } },
        { setName: { contains: query, mode: "insensitive" as const } },
        { setCode: { contains: query, mode: "insensitive" as const } },
      ],
    }),
    ...(tcg && { tcg: tcg as TCG }),
    ...(productType && { productType: productType as SealedProductType }),
  };

  const [products, total] = await Promise.all([
    db.sealedProduct.findMany({
      where,
      include: { set: true },
      orderBy: [{ tcg: "asc" }, { name: "asc" }],
      skip,
      take: limit,
    }),
    db.sealedProduct.count({ where }),
  ]);

  return { products, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Get a single sealed product by ID with prices.
 */
export async function getSealedProduct(id: string) {
  return db.sealedProduct.findUnique({
    where: { id },
    include: { set: true },
  });
}

/**
 * Get all sealed products in a given set.
 */
export async function getSealedProductsBySet(setId: string) {
  return db.sealedProduct.findMany({
    where: { setId },
    orderBy: { name: "asc" },
  });
}
