"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MAX_PHOTO_SIZE_BYTES } from "@/lib/constants";
import { CONDITION_LABELS, type Condition } from "@/types/domain";
import type { AIGradingResult } from "@/types/ximilar";
import { CenteringTool } from "./centering-tool";
import type { CenteringMeasurement } from "@/lib/centering";

interface AIGradingStepProps {
  onComplete: (result: { aiResult: AIGradingResult | null; suggestedCondition: Condition }) => void;
  onSkip: () => void;
}

const CCS_DIMENSION_LABELS: Record<string, string> = {
  surface: "Surface",
  corners: "Corners",
  edges: "Edges",
  centering: "Centering",
};

export function AIGradingStep({ onComplete, onSkip }: AIGradingStepProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [grading, setGrading] = useState(false);
  const [result, setResult] = useState<AIGradingResult | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [showCenteringTool, setShowCenteringTool] = useState(false);
  const [manualCentering, setManualCentering] = useState<CenteringMeasurement | null>(null);

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    setResult(null);
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (files.length > 4) {
      setError("Maximum 4 photos allowed");
      return;
    }

    const readers = files.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
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
      .then(setPhotos)
      .catch((err) => setError(err.message));
  }

  async function handleGrade() {
    if (photos.length === 0) return;
    setGrading(true);
    setError("");

    try {
      const res = await fetch("/api/ai-grading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photos }),
      });

      const gradingResult = (await res.json()) as AIGradingResult;
      setResult(gradingResult);

      if (!gradingResult.success) {
        setError(gradingResult.error ?? "Grading failed");
      }
    } catch {
      setError("Something went wrong. You can skip AI grading and set condition manually.");
    } finally {
      setGrading(false);
    }
  }

  function handleAccept() {
    if (result?.success && result.suggestedCondition) {
      onComplete({
        aiResult: result,
        suggestedCondition: result.suggestedCondition as Condition,
      });
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-gray-900">AI Condition Assessment</h3>
        <p className="mt-1 text-sm text-gray-500">
          Upload front and back photos for an AI-powered condition estimate. This helps buyers trust
          your listing.
        </p>
      </div>

      {/* Photo guide */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
        <p className="font-medium text-gray-700">Photo tips:</p>
        <ul className="mt-1 list-inside list-disc space-y-0.5">
          <li>Place card on a solid, contrasting background</li>
          <li>Use even lighting — avoid flash and glare</li>
          <li>Photograph straight above the card</li>
          <li>Remove from sleeve or toploader</li>
        </ul>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFiles}
      />

      {photos.length === 0 ? (
        <Button
          variant="outline"
          onClick={() => inputRef.current?.click()}
          className="w-full border-dashed"
        >
          Select Photos (front + back)
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            {photos.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`Card photo ${i + 1}`}
                className="h-28 w-20 rounded-md border object-cover"
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={handleGrade} disabled={grading} size="sm">
              {grading ? "Analyzing..." : "Analyze Condition"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPhotos([]);
                setResult(null);
                setError("");
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      {/* AI Result */}
      {result?.success && result.ccs && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-green-900">AI Assessment</h4>
            <Badge className="bg-green-100 text-green-800">
              {result.suggestedSubTier} ({CONDITION_LABELS[result.suggestedCondition as Condition]})
            </Badge>
          </div>

          <div className="mt-3 text-sm text-green-800">
            <p className="font-medium">CCS: {result.ccs.composite.toFixed(1)}</p>
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
              {(["surface", "corners", "edges", "centering"] as const).map((dim) => (
                <div key={dim} className="flex justify-between">
                  <span className="text-green-600">{CCS_DIMENSION_LABELS[dim]}</span>
                  <span className="font-medium">{result.ccs![dim].toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            You can adjust the condition on the next step if you disagree.
          </p>

          {/* Manual centering refinement */}
          {!showCenteringTool ? (
            <button
              type="button"
              onClick={() => setShowCenteringTool(true)}
              className="mt-3 text-xs text-green-700 underline hover:text-green-900"
            >
              Refine centering manually
            </button>
          ) : (
            <div className="mt-3 border-t border-green-200 pt-3">
              <CenteringTool
                mode="inline"
                photoUrl={photos[0]}
                onMeasurementComplete={(m) => setManualCentering(m)}
              />
              {manualCentering && (
                <p className="mt-2 text-xs text-green-700">
                  Manual centering: CCS {manualCentering.ccsScore.toFixed(1)} (
                  {manualCentering.rating})
                  {result?.ccs && manualCentering.ccsScore !== result.ccs.centering && (
                    <span className="ml-1 text-amber-700">
                      — AI said {result.ccs.centering.toFixed(1)}
                    </span>
                  )}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 border-t border-gray-100 pt-4">
        <Button variant="outline" onClick={onSkip}>
          Skip — Set Condition Manually
        </Button>
        {result?.success && <Button onClick={handleAccept}>Accept & Continue</Button>}
      </div>
    </div>
  );
}
