import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { photoReviewSchema } from "@/lib/validators";
import { getConfigs } from "@/server/services/config.service";
import { submitPhotos, reviewPhotos } from "@/server/services/photo-approval.service";

type RouteContext = { params: Promise<{ tradeId: string; legId: string }> };

async function getAuthorizedLeg(tradeId: string, legId: string, userId: string) {
  const leg = await db.tradeLeg.findUnique({
    where: { id: legId },
    include: { trade: true, photoApproval: true },
  });

  if (!leg || leg.tradeId !== tradeId) return null;
  if (!leg.trade.participantIds.includes(userId)) return null;
  return leg;
}

// GET — Return photo approval record for a leg
export async function GET(_req: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tradeId, legId } = await context.params;
  const leg = await getAuthorizedLeg(tradeId, legId, session.user.id);
  if (!leg) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ photoApproval: leg.photoApproval });
}

// POST — Sender uploads photos (base64 JSON body)
export async function POST(req: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tradeId, legId } = await context.params;
  const leg = await getAuthorizedLeg(tradeId, legId, session.user.id);
  if (!leg) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { "thresholds.max_photo_count": maxPhotoCount, "thresholds.max_photo_size_bytes": maxPhotoSize } =
    await getConfigs(["thresholds.max_photo_count", "thresholds.max_photo_size_bytes"]);

  let photos: string[];
  try {
    const body = await req.json();
    photos = body.photos;
    if (!Array.isArray(photos) || photos.length === 0 || photos.length > maxPhotoCount) {
      return NextResponse.json(
        { error: `Provide 1-${maxPhotoCount} photos` },
        { status: 400 }
      );
    }
    for (const p of photos) {
      if (typeof p !== "string" || !p.startsWith("data:image/")) {
        return NextResponse.json(
          { error: "Each photo must be a base64 data URL (data:image/...)" },
          { status: 400 }
        );
      }
      const sizeBytes = Math.ceil((p.length * 3) / 4);
      if (sizeBytes > maxPhotoSize) {
        return NextResponse.json(
          { error: `Each photo must be under ${maxPhotoSize / (1024 * 1024)}MB` },
          { status: 400 }
        );
      }
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await submitPhotos(legId, session.user.id, photos);
    return NextResponse.json({ photoApproval: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to submit photos";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// PATCH — Receiver approves or rejects photos
export async function PATCH(req: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tradeId, legId } = await context.params;
  const leg = await getAuthorizedLeg(tradeId, legId, session.user.id);
  if (!leg) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = photoReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const result = await reviewPhotos(
      legId,
      session.user.id,
      parsed.data.approved,
      parsed.data.rejectionNote
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to review photos";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
