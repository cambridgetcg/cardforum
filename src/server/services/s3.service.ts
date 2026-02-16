import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const PRESIGN_EXPIRES_IN = 300; // 5 minutes

function getClient(): S3Client {
  return new S3Client({
    region: process.env.AWS_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

function getBucket(): string {
  const bucket = process.env.S3_KYC_BUCKET;
  if (!bucket) throw new Error("S3_KYC_BUCKET environment variable is not set");
  return bucket;
}

/**
 * Generate a presigned PUT URL for uploading a file to S3.
 * The client uses this URL to upload directly to S3 (no file passes through our server).
 */
export async function getPresignedUploadUrl(
  storageKey: string,
  mimeType: string,
  maxSizeBytes: number = 10 * 1024 * 1024,
): Promise<{ uploadUrl: string; expiresIn: number }> {
  const client = getClient();
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: storageKey,
    ContentType: mimeType,
    ContentLength: maxSizeBytes, // used as maximum in presigned URL
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: PRESIGN_EXPIRES_IN,
  });

  return { uploadUrl, expiresIn: PRESIGN_EXPIRES_IN };
}

/**
 * Generate a presigned GET URL for downloading a file from S3.
 * Used by admin reviewers to view KYC documents.
 */
export async function getPresignedDownloadUrl(
  storageKey: string,
  expiresIn: number = 3600,
): Promise<string> {
  const client = getClient();
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: storageKey,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Delete a file from S3. Used for cleanup after KYC rejection or document replacement.
 */
export async function deleteObject(storageKey: string): Promise<void> {
  const client = getClient();
  await client.send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: storageKey,
    }),
  );
}
