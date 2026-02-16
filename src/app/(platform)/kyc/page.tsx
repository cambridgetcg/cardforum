"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from "lucide-react";

type KYCStatus =
  | "UNVERIFIED"
  | "BASIC_PENDING"
  | "BASIC_VERIFIED"
  | "BASIC_REJECTED"
  | "ENHANCED_PENDING"
  | "ENHANCED_VERIFIED"
  | "ENHANCED_REJECTED"
  | "SUSPENDED"
  | "REVOKED";

type DocumentType = "GOVERNMENT_ID" | "SELFIE" | "PROOF_OF_ADDRESS" | "BANK_VERIFICATION";

interface KYCDocument {
  id: string;
  type: DocumentType;
  status: string;
  fileName: string;
  createdAt: string;
  rejectionReason: string | null;
}

interface KYCData {
  status: KYCStatus;
  verifiedAt: string | null;
  rejectionReason: string | null;
  documents: KYCDocument[];
}

const STATUS_CONFIG: Record<
  KYCStatus,
  { label: string; color: string; bgColor: string; Icon: typeof Shield }
> = {
  UNVERIFIED: { label: "Unverified", color: "text-gray-600", bgColor: "bg-gray-100", Icon: Shield },
  BASIC_PENDING: { label: "Basic — Pending Review", color: "text-amber-700", bgColor: "bg-amber-50", Icon: Clock },
  BASIC_VERIFIED: { label: "Basic — Verified", color: "text-green-700", bgColor: "bg-green-50", Icon: ShieldCheck },
  BASIC_REJECTED: { label: "Basic — Rejected", color: "text-red-700", bgColor: "bg-red-50", Icon: ShieldAlert },
  ENHANCED_PENDING: { label: "Enhanced — Pending Review", color: "text-amber-700", bgColor: "bg-amber-50", Icon: Clock },
  ENHANCED_VERIFIED: { label: "Enhanced — Verified", color: "text-emerald-700", bgColor: "bg-emerald-50", Icon: ShieldCheck },
  ENHANCED_REJECTED: { label: "Enhanced — Rejected", color: "text-red-700", bgColor: "bg-red-50", Icon: ShieldAlert },
  SUSPENDED: { label: "Suspended", color: "text-red-700", bgColor: "bg-red-50", Icon: AlertTriangle },
  REVOKED: { label: "Revoked", color: "text-red-800", bgColor: "bg-red-100", Icon: XCircle },
};

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  GOVERNMENT_ID: "Government-Issued ID",
  SELFIE: "Selfie (Liveness Check)",
  PROOF_OF_ADDRESS: "Proof of Address",
  BANK_VERIFICATION: "Bank Account Verification",
};

const ACCEPTED_TYPES = "image/jpeg,image/png,application/pdf";

function StatusBadge({ status }: { status: KYCStatus }) {
  const { label, color, bgColor, Icon } = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${color} ${bgColor}`}>
      <Icon className="h-4 w-4" />
      {label}
    </span>
  );
}

function TierCard({
  tier,
  title,
  description,
  caps,
  requirements,
  canSubmit,
  isCurrent,
  onSubmit,
}: {
  tier: "BASIC" | "ENHANCED";
  title: string;
  description: string;
  caps: string[];
  requirements: { type: DocumentType; label: string }[];
  canSubmit: boolean;
  isCurrent: boolean;
  onSubmit: (tier: "BASIC" | "ENHANCED") => void;
}) {
  return (
    <div
      className={`rounded-xl border p-6 ${
        isCurrent
          ? "border-indigo-200 bg-indigo-50/50"
          : canSubmit
            ? "border-gray-200 bg-white"
            : "border-gray-100 bg-gray-50 opacity-60"
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {isCurrent && (
          <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
            Current
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-gray-600">{description}</p>

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Limits</p>
        <ul className="mt-1 space-y-1">
          {caps.map((cap) => (
            <li key={cap} className="flex items-center gap-1.5 text-sm text-gray-700">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              {cap}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Required Documents
        </p>
        <ul className="mt-1 space-y-1">
          {requirements.map((req) => (
            <li key={req.type} className="flex items-center gap-1.5 text-sm text-gray-700">
              <FileText className="h-3.5 w-3.5 text-gray-400" />
              {req.label}
            </li>
          ))}
        </ul>
      </div>

      {canSubmit && (
        <Button className="mt-5 w-full" onClick={() => onSubmit(tier)}>
          Start {title} Verification
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function DocumentUploadForm({
  tier,
  onCancel,
  onSuccess,
}: {
  tier: "BASIC" | "ENHANCED";
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<Record<DocumentType, File | null>>({
    GOVERNMENT_ID: null,
    SELFIE: null,
    PROOF_OF_ADDRESS: null,
    BANK_VERIFICATION: null,
  });

  const requiredDocs: DocumentType[] =
    tier === "BASIC"
      ? ["GOVERNMENT_ID", "SELFIE"]
      : ["PROOF_OF_ADDRESS"];

  const allRequiredPresent = requiredDocs.every((dt) => files[dt] !== null);

  async function uploadFile(file: File, documentType: DocumentType): Promise<{
    type: DocumentType;
    fileName: string;
    fileSize: number;
    mimeType: string;
    storageKey: string;
  }> {
    // Get presigned URL
    const urlRes = await fetch("/api/kyc/documents/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type,
        documentType,
      }),
    });
    if (!urlRes.ok) {
      const data = await urlRes.json();
      throw new Error(data.error ?? "Failed to get upload URL");
    }
    const { storageKey, uploadUrl } = await urlRes.json();

    // Upload file directly to S3 via presigned PUT URL
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!uploadRes.ok) {
      throw new Error("File upload failed");
    }

    return {
      type: documentType,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      storageKey,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setUploading(true);

    try {
      // Upload each file and get document metadata
      const documents = await Promise.all(
        requiredDocs
          .filter((dt) => files[dt] !== null)
          .map((dt) => uploadFile(files[dt]!, dt))
      );

      // Submit KYC
      const res = await fetch("/api/kyc/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, documents }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.error)
        );
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-indigo-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900">
        {tier === "BASIC" ? "Basic" : "Enhanced"} Verification
      </h3>
      <p className="mt-1 text-sm text-gray-600">
        Upload the required documents below. Accepted formats: JPEG, PNG, PDF (max 10 MB each).
      </p>

      <div className="mt-5 space-y-4">
        {requiredDocs.map((docType) => (
          <div key={docType}>
            <label className="block text-sm font-medium text-gray-700">
              {DOC_TYPE_LABELS[docType]}
              <span className="text-red-500"> *</span>
            </label>
            <div className="mt-1">
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-gray-300 px-4 py-3 transition hover:border-indigo-400 hover:bg-indigo-50/30">
                <Upload className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {files[docType] ? files[docType]!.name : "Choose file..."}
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept={ACCEPTED_TYPES}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    if (file && file.size > 10 * 1024 * 1024) {
                      setError("File must be under 10 MB");
                      return;
                    }
                    setFiles((prev) => ({ ...prev, [docType]: file }));
                  }}
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <Button type="submit" disabled={!allRequiredPresent || uploading}>
          {uploading ? "Submitting..." : "Submit for Review"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={uploading}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function DocumentHistory({ documents }: { documents: KYCDocument[] }) {
  if (documents.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-sm font-semibold text-gray-900">Submitted Documents</h3>
      <div className="mt-3 divide-y divide-gray-100">
        {documents.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-2.5">
              <FileText className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {DOC_TYPE_LABELS[doc.type] ?? doc.type}
                </p>
                <p className="text-xs text-gray-500">{doc.fileName}</p>
              </div>
            </div>
            <div className="text-right">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                  doc.status === "APPROVED"
                    ? "bg-green-100 text-green-700"
                    : doc.status === "REJECTED"
                      ? "bg-red-100 text-red-700"
                      : "bg-amber-100 text-amber-700"
                }`}
              >
                {doc.status}
              </span>
              {doc.rejectionReason && (
                <p className="mt-0.5 text-xs text-red-600">{doc.rejectionReason}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function KYCPage() {
  const [kyc, setKyc] = useState<KYCData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadTier, setUploadTier] = useState<"BASIC" | "ENHANCED" | null>(null);

  const fetchStatus = useCallback(async () => {
    const res = await fetch("/api/kyc/status");
    if (res.ok) {
      setKyc(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-gray-500">Loading KYC status...</p>
      </div>
    );
  }

  if (!kyc) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-red-600">Failed to load KYC status.</p>
      </div>
    );
  }

  const status = kyc.status;
  const isPending = status === "BASIC_PENDING" || status === "ENHANCED_PENDING";
  const isTerminal = status === "SUSPENDED" || status === "REVOKED";

  // Determine which actions are available
  const canSubmitBasic = status === "UNVERIFIED" || status === "BASIC_REJECTED";
  const canSubmitEnhanced = status === "BASIC_VERIFIED" || status === "ENHANCED_REJECTED";
  const isBasicDone = ["BASIC_VERIFIED", "ENHANCED_PENDING", "ENHANCED_VERIFIED", "ENHANCED_REJECTED"].includes(status);
  const isEnhancedDone = status === "ENHANCED_VERIFIED";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">Identity Verification</h1>
      <p className="mt-1 text-sm text-gray-600">
        Verify your identity to unlock higher listing and trading limits.
      </p>

      {/* Status banner */}
      <div className="mt-6 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-6 py-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Current Status
          </p>
          <div className="mt-1">
            <StatusBadge status={status} />
          </div>
        </div>
        {kyc.verifiedAt && (
          <p className="text-xs text-gray-500">
            Verified {new Date(kyc.verifiedAt).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Rejection notice */}
      {kyc.rejectionReason && (status === "BASIC_REJECTED" || status === "ENHANCED_REJECTED") && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-800">Verification Rejected</p>
          <p className="mt-1 text-sm text-red-700">{kyc.rejectionReason}</p>
          <p className="mt-2 text-xs text-red-600">
            You can resubmit your documents below.
          </p>
        </div>
      )}

      {/* Pending notice */}
      {isPending && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-800">Under Review</p>
          <p className="mt-1 text-xs text-amber-700">
            Your documents are being reviewed. This usually takes 1-2 business days.
          </p>
        </div>
      )}

      {/* Suspended/Revoked notice */}
      {isTerminal && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-800">
            Account {status === "SUSPENDED" ? "Suspended" : "Revoked"}
          </p>
          <p className="mt-1 text-xs text-red-700">
            {status === "SUSPENDED"
              ? "Your verification has been suspended. Contact support for assistance."
              : "Your verification has been permanently revoked."}
          </p>
        </div>
      )}

      {/* Upload form */}
      {uploadTier && !isPending && !isTerminal && (
        <div className="mt-6">
          <DocumentUploadForm
            tier={uploadTier}
            onCancel={() => setUploadTier(null)}
            onSuccess={() => {
              setUploadTier(null);
              fetchStatus();
            }}
          />
        </div>
      )}

      {/* Tier cards */}
      {!uploadTier && !isTerminal && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <TierCard
            tier="BASIC"
            title="Basic Verification"
            description="Verify your identity with a government ID and selfie."
            caps={["List cards up to $500 each", "Trade up to $1,000 per trade"]}
            requirements={[
              { type: "GOVERNMENT_ID", label: "Government-Issued ID" },
              { type: "SELFIE", label: "Selfie (Liveness Check)" },
            ]}
            canSubmit={canSubmitBasic && !isPending}
            isCurrent={isBasicDone && !isEnhancedDone}
            onSubmit={setUploadTier}
          />
          <TierCard
            tier="ENHANCED"
            title="Enhanced Verification"
            description="Add proof of address for higher limits."
            caps={["Unlimited listing value", "Unlimited trade value", "Apply as authenticator"]}
            requirements={[
              { type: "PROOF_OF_ADDRESS", label: "Proof of Address (utility bill, bank statement)" },
            ]}
            canSubmit={canSubmitEnhanced && !isPending}
            isCurrent={isEnhancedDone}
            onSubmit={setUploadTier}
          />
        </div>
      )}

      {/* Document history */}
      {kyc.documents.length > 0 && (
        <div className="mt-6">
          <DocumentHistory documents={kyc.documents} />
        </div>
      )}
    </div>
  );
}
