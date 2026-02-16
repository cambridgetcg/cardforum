import { NextResponse } from "next/server";
import { withAuthParams } from "@/server/middleware/with-auth";
import { removeFromCollection, updateCollectionEntry } from "@/server/services/collection.service";
import { z } from "zod";

const updateSchema = z.object({
  quantity: z.number().int().min(1).max(999).optional(),
  notes: z.string().max(500).optional(),
  pricePaid: z.number().int().min(0).max(10_000_000).nullable().optional(),
});

// PATCH /api/collection/[entryId] — Update quantity/notes
export const PATCH = withAuthParams<{ entryId: string }>(
  async (req, { userId }, params) => {
    const { entryId } = await params;
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    try {
      const result = await updateCollectionEntry(userId, entryId, parsed.data);
      if (result.count === 0) {
        return NextResponse.json({ error: "Entry not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
    }
  },
);

// DELETE /api/collection/[entryId] — Remove from collection
export const DELETE = withAuthParams<{ entryId: string }>(
  async (_req, { userId }, params) => {
    const { entryId } = await params;

    try {
      const result = await removeFromCollection(userId, entryId);
      if (result.count === 0) {
        return NextResponse.json({ error: "Entry not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json({ error: "Failed to remove entry" }, { status: 500 });
    }
  },
);
