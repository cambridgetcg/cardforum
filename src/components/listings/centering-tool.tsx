"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  calculateCenteringScore,
  formatCenteringRatio,
  type CenteringMeasurement,
} from "@/lib/centering";

// ─── Types ──────────────────────────────────────────────

interface Point {
  x: number;
  y: number;
}

type Corner = "topLeft" | "topRight" | "bottomRight" | "bottomLeft";

interface Borders {
  outer: Record<Corner, Point | null>;
  inner: Record<Corner, Point | null>;
}

type PlacementPhase = "outer" | "inner" | "done";

const CORNER_ORDER: Corner[] = [
  "topLeft",
  "topRight",
  "bottomRight",
  "bottomLeft",
];

const CORNER_LABELS: Record<Corner, string> = {
  topLeft: "top-left",
  topRight: "top-right",
  bottomRight: "bottom-right",
  bottomLeft: "bottom-left",
};

// ─── Props ──────────────────────────────────────────────

interface CenteringToolProps {
  /** Pre-loaded base64 photo from the AI grading step. */
  photoUrl?: string;
  /** Called when all 8 markers are placed and measurement is computed. */
  onMeasurementComplete?: (measurement: CenteringMeasurement) => void;
  /** 'inline' fits inside AI grading step; 'standalone' is a full-size tool. */
  mode?: "inline" | "standalone";
}

// ─── Constants ──────────────────────────────────────────

const MARKER_RADIUS = 6;
const MARKER_HIT_RADIUS = 14; // larger for easier touch/drag

const RATING_COLORS: Record<string, string> = {
  perfect: "text-green-700 bg-green-50",
  excellent: "text-green-600 bg-green-50",
  good: "text-blue-700 bg-blue-50",
  fair: "text-yellow-700 bg-yellow-50",
  poor: "text-orange-700 bg-orange-50",
  "very-poor": "text-red-700 bg-red-50",
};

// ─── Component ──────────────────────────────────────────

export function CenteringTool({
  photoUrl,
  onMeasurementComplete,
  mode = "standalone",
}: CenteringToolProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [photo, setPhoto] = useState<string | null>(photoUrl ?? null);
  const [borders, setBorders] = useState<Borders>({
    outer: { topLeft: null, topRight: null, bottomRight: null, bottomLeft: null },
    inner: { topLeft: null, topRight: null, bottomRight: null, bottomLeft: null },
  });
  const [phase, setPhase] = useState<PlacementPhase>("outer");
  const [nextCorner, setNextCorner] = useState(0); // index into CORNER_ORDER
  const [dragging, setDragging] = useState<{
    border: "outer" | "inner";
    corner: Corner;
  } | null>(null);
  const [measurement, setMeasurement] = useState<CenteringMeasurement | null>(
    null,
  );

  // Canvas sizing — maintain 5:7 card ratio
  const canvasWidth = mode === "inline" ? 360 : 480;
  const canvasHeight = Math.round(canvasWidth * 1.4);

  // ─── Photo loading ──────────────────────────────────

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    if (!photo) return;
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      draw();
    };
    img.src = photo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo]);

  // ─── Drawing ────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw photo
    if (imageRef.current) {
      const img = imageRef.current;
      const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (canvas.width - w) / 2;
      const y = (canvas.height - h) / 2;
      ctx.drawImage(img, x, y, w, h);
    } else {
      ctx.fillStyle = "#f3f4f6";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#9ca3af";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Upload a card photo", canvas.width / 2, canvas.height / 2);
    }

    // Draw borders
    drawBorder(ctx, borders.outer, "#3b82f6", "Card Edge");
    drawBorder(ctx, borders.inner, "#22c55e", "Print Area");

    // Draw centering lines if both borders are complete
    if (allPlaced(borders.outer) && allPlaced(borders.inner)) {
      drawCenteringLines(ctx, borders.outer, borders.inner);
    }
  }, [borders, canvasWidth, canvasHeight]);

  useEffect(() => {
    draw();
  }, [draw]);

  function drawBorder(
    ctx: CanvasRenderingContext2D,
    corners: Record<Corner, Point | null>,
    color: string,
    _label: string,
  ) {
    const points = CORNER_ORDER.map((c) => corners[c]).filter(Boolean) as Point[];

    // Draw lines between placed points
    if (points.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      if (points.length === 4) ctx.closePath();
      ctx.stroke();
    }

    // Draw marker dots
    for (const pt of points) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, MARKER_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function drawCenteringLines(
    ctx: CanvasRenderingContext2D,
    outer: Record<Corner, Point | null>,
    inner: Record<Corner, Point | null>,
  ) {
    // Draw dashed measurement lines between outer and inner borders
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 1;

    const o = outer as Record<Corner, Point>;
    const i = inner as Record<Corner, Point>;

    // Left border width
    drawMeasureLine(ctx, midY(o.topLeft, o.bottomLeft), midY(i.topLeft, i.bottomLeft));
    // Right border width
    drawMeasureLine(ctx, midY(o.topRight, o.bottomRight), midY(i.topRight, i.bottomRight));
    // Top border width
    drawMeasureLine(ctx, midX(o.topLeft, o.topRight), midX(i.topLeft, i.topRight));
    // Bottom border width
    drawMeasureLine(ctx, midX(o.bottomLeft, o.bottomRight), midX(i.bottomLeft, i.bottomRight));

    ctx.setLineDash([]);
  }

  function drawMeasureLine(ctx: CanvasRenderingContext2D, a: Point, b: Point) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // ─── Measurement ────────────────────────────────────

  useEffect(() => {
    if (!allPlaced(borders.outer) || !allPlaced(borders.inner)) {
      setMeasurement(null);
      return;
    }

    const o = borders.outer as Record<Corner, Point>;
    const i = borders.inner as Record<Corner, Point>;

    // Border widths (in pixels)
    const leftOuter = midY(o.topLeft, o.bottomLeft).x;
    const leftInner = midY(i.topLeft, i.bottomLeft).x;
    const rightOuter = midY(o.topRight, o.bottomRight).x;
    const rightInner = midY(i.topRight, i.bottomRight).x;

    const topOuter = midX(o.topLeft, o.topRight).y;
    const topInner = midX(i.topLeft, i.topRight).y;
    const bottomOuter = midX(o.bottomLeft, o.bottomRight).y;
    const bottomInner = midX(i.bottomLeft, i.bottomRight).y;

    const left = leftInner - leftOuter;
    const right = rightOuter - rightInner;
    const top = topInner - topOuter;
    const bottom = bottomOuter - bottomInner;

    const m = calculateCenteringScore({
      leftRight: { left: Math.max(0, left), right: Math.max(0, right) },
      topBottom: { top: Math.max(0, top), bottom: Math.max(0, bottom) },
    });

    setMeasurement(m);
    onMeasurementComplete?.(m);
  }, [borders, onMeasurementComplete]);

  // ─── Interaction ────────────────────────────────────

  function getCanvasPoint(e: React.MouseEvent<HTMLCanvasElement>): Point {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function findNearestMarker(
    pt: Point,
  ): { border: "outer" | "inner"; corner: Corner } | null {
    const threshold = MARKER_HIT_RADIUS * (canvasWidth / 480); // scale threshold

    for (const borderKey of ["outer", "inner"] as const) {
      for (const corner of CORNER_ORDER) {
        const marker = borders[borderKey][corner];
        if (marker && dist(pt, marker) < threshold) {
          return { border: borderKey, corner };
        }
      }
    }
    return null;
  }

  function handleCanvasMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!photo) return;
    const pt = getCanvasPoint(e);

    // Try to start dragging an existing marker
    const hit = findNearestMarker(pt);
    if (hit) {
      setDragging(hit);
      return;
    }

    // Place next marker in sequence
    if (phase === "done") return;

    const corner = CORNER_ORDER[nextCorner];
    setBorders((prev) => ({
      ...prev,
      [phase]: { ...prev[phase], [corner]: pt },
    }));

    if (nextCorner < 3) {
      setNextCorner(nextCorner + 1);
    } else {
      // Completed this phase
      if (phase === "outer") {
        setPhase("inner");
        setNextCorner(0);
      } else {
        setPhase("done");
      }
    }
  }

  function handleCanvasMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!dragging) return;
    const pt = getCanvasPoint(e);
    setBorders((prev) => ({
      ...prev,
      [dragging.border]: { ...prev[dragging.border], [dragging.corner]: pt },
    }));
  }

  function handleCanvasMouseUp() {
    setDragging(null);
  }

  function handleReset() {
    setBorders({
      outer: { topLeft: null, topRight: null, bottomRight: null, bottomLeft: null },
      inner: { topLeft: null, topRight: null, bottomRight: null, bottomLeft: null },
    });
    setPhase("outer");
    setNextCorner(0);
    setMeasurement(null);
  }

  // ─── Render ─────────────────────────────────────────

  const instruction =
    phase === "outer"
      ? `Click the ${CORNER_LABELS[CORNER_ORDER[nextCorner]]} corner of the card edge`
      : phase === "inner"
        ? `Click the ${CORNER_LABELS[CORNER_ORDER[nextCorner]]} corner of the print area`
        : "Drag markers to adjust. Measurement updates in real-time.";

  return (
    <div className="space-y-4">
      {mode === "standalone" && (
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Centering Calculator
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Upload a card photo and mark the card edge and print area borders to
            calculate centering.
          </p>
        </div>
      )}

      {/* Photo upload (if no photo) */}
      {!photo && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="outline"
            onClick={() => inputRef.current?.click()}
            className="w-full border-dashed"
          >
            Upload Card Photo
          </Button>
        </>
      )}

      {/* Canvas */}
      {photo && (
        <div className="space-y-3">
          {/* Instruction banner */}
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
            <span className="font-medium">
              {phase === "outer"
                ? "Step 1/2:"
                : phase === "inner"
                  ? "Step 2/2:"
                  : "Done!"}
            </span>{" "}
            {instruction}
          </div>

          {/* Legend */}
          <div className="flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-full bg-blue-500" />
              Card Edge
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
              Print Area
            </span>
          </div>

          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="w-full cursor-crosshair rounded-lg border border-gray-200"
            style={{ maxWidth: canvasWidth }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
          />

          {/* Measurement result */}
          {measurement && (
            <div
              className={`rounded-lg border p-4 ${RATING_COLORS[measurement.rating] ?? "bg-gray-50 text-gray-700"}`}
            >
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Centering Score</h4>
                <Badge variant="info">CCS {measurement.ccsScore.toFixed(1)}</Badge>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Left / Right</span>
                  <span className="font-medium">
                    {formatCenteringRatio(
                      measurement.leftRight.left,
                      measurement.leftRight.right,
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Top / Bottom</span>
                  <span className="font-medium">
                    {formatCenteringRatio(
                      measurement.topBottom.top,
                      measurement.topBottom.bottom,
                    )}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs capitalize opacity-70">
                Rating: {measurement.rating}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              Reset Markers
            </Button>
            {!photoUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPhoto(null);
                  handleReset();
                }}
              >
                Change Photo
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Geometry Helpers ─────────────────────────────────────

function allPlaced(corners: Record<Corner, Point | null>): boolean {
  return CORNER_ORDER.every((c) => corners[c] !== null);
}

function midX(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function midY(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
