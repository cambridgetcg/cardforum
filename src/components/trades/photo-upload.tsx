"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { MAX_PHOTO_COUNT, MAX_PHOTO_SIZE_BYTES } from "@/lib/constants";

interface PhotoUploadProps {
  tradeId: string;
  legId: string;
  status: string;
  rejectionNote?: string | null;
  attempts: number;
  onSubmitted: () => void;
}

export function PhotoUpload({
  tradeId,
  legId,
  status,
  rejectionNote,
  attempts,
  onSubmitted,
}: PhotoUploadProps) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (files.length > MAX_PHOTO_COUNT) {
      setError(`Maximum ${MAX_PHOTO_COUNT} photos allowed`);
      return;
    }

    const readers: Promise<string>[] = files.map(
      (file) =>
        new Promise((resolve, reject) => {
          if (file.size > MAX_PHOTO_SIZE_BYTES) {
            reject(new Error(`${file.name} exceeds ${MAX_PHOTO_SIZE_BYTES / (1024 * 1024)}MB`));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
          reader.readAsDataURL(file);
        }),
    );

    Promise.all(readers)
      .then(setPreviews)
      .catch((err) => setError(err.message));
  }

  async function handleSubmit() {
    if (previews.length === 0) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/trades/${tradeId}/legs/${legId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photos: previews }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Upload failed");
      }
      setPreviews([]);
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
      {status === "REJECTED" && rejectionNote && (
        <p className="text-sm text-red-600">
          <span className="font-medium">Rejected:</span> {rejectionNote}
        </p>
      )}
      {status === "REJECTED" && (
        <p className="text-xs text-gray-500">
          Attempt {attempts} of 2 used. Please upload new photos.
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFiles}
      />

      {previews.length > 0 ? (
        <div className="flex gap-2">
          {previews.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`Preview ${i + 1}`}
              className="h-20 w-20 rounded-md border object-cover"
            />
          ))}
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
          Select Photos (max {MAX_PHOTO_COUNT})
        </Button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {previews.length > 0 && (
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Uploading..." : "Submit Photos"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setPreviews([]);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            Clear
          </Button>
        </div>
      )}

      {status === "PENDING_REVIEW" && (
        <p className="text-sm text-blue-600">Submitted — Awaiting receiver review</p>
      )}
    </div>
  );
}
