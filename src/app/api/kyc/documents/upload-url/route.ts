import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { randomUUID } from "crypto";
import { getPresignedUploadUrl } from "@/server/services/s3.service";

const uploadUrlSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
  documentType: z.enum(["GOVERNMENT_ID", "SELFIE", "PROOF_OF_ADDRESS", "BANK_VERIFICATION"]),
});

// POST /api/kyc/documents/upload-url — Get presigned S3 upload URL
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = uploadUrlSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const docId = randomUUID();
  const storageKey = `kyc/${session.user.id}/${docId}/${parsed.data.fileName}`;

  try {
    const { uploadUrl, expiresIn } = await getPresignedUploadUrl(
      storageKey,
      parsed.data.mimeType,
    );

    return NextResponse.json({ storageKey, uploadUrl, expiresIn });
  } catch (error) {
    console.error("[kyc/upload-url] S3 presign failed:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 },
    );
  }
}
