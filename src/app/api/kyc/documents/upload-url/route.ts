import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { randomUUID } from "crypto";

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

  // TODO: Generate presigned S3 PUT URL using AWS SDK
  // For now, return the storage key so the client knows where the file will go.
  // In production, this would call S3.getSignedUrl('putObject', { ... })
  return NextResponse.json({
    storageKey,
    uploadUrl: `https://s3.placeholder.local/${storageKey}`,
    expiresIn: 300,
  });
}
