import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { submitBasicKYC, submitEnhancedKYC } from "@/server/services/kyc.service";
import { submitBasicKYCSchema, submitEnhancedKYCSchema } from "@/lib/validators";
import { z } from "zod";

const submitKYCBodySchema = z.object({
  tier: z.enum(["BASIC", "ENHANCED"]),
  documents: z.array(z.any()),
});

// POST /api/kyc/submit — Submit basic or enhanced KYC
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const envelope = submitKYCBodySchema.safeParse(body);
  if (!envelope.success) {
    return NextResponse.json(
      { error: envelope.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    if (envelope.data.tier === "BASIC") {
      const parsed = submitBasicKYCSchema.safeParse({ documents: envelope.data.documents });
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.flatten().fieldErrors },
          { status: 400 },
        );
      }
      const user = await submitBasicKYC(session.user.id, parsed.data);
      return NextResponse.json({ kycStatus: user.kycStatus }, { status: 201 });
    } else {
      const parsed = submitEnhancedKYCSchema.safeParse({ documents: envelope.data.documents });
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.flatten().fieldErrors },
          { status: 400 },
        );
      }
      const user = await submitEnhancedKYC(session.user.id, parsed.data);
      return NextResponse.json({ kycStatus: user.kycStatus }, { status: 201 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to submit KYC";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
