"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PullRate {
  rarity: string;
  perPack: number;
  perBox: number;
  packProbability: number;
  boxProbability: number;
  perSpecificCardPerBox: number;
  uniqueCards: number;
}

interface PullRateTableProps {
  rates: PullRate[];
  packsPerBox: number;
  setCode: string;
  language: string;
}

const RARITY_COLORS: Record<string, string> = {
  C: "bg-gray-100 text-gray-700",
  UC: "bg-green-100 text-green-700",
  R: "bg-blue-100 text-blue-700",
  SR: "bg-purple-100 text-purple-700",
  SEC: "bg-amber-100 text-amber-700",
  L: "bg-rose-100 text-rose-700",
  SP: "bg-pink-100 text-pink-700",
  "Manga Rare": "bg-orange-100 text-orange-700",
  "Alt Art": "bg-indigo-100 text-indigo-700",
};

function formatPct(value: number): string {
  if (value >= 1) return "100%";
  if (value >= 0.1) return `${(value * 100).toFixed(1)}%`;
  if (value >= 0.01) return `${(value * 100).toFixed(2)}%`;
  return `${(value * 100).toFixed(3)}%`;
}

function formatOdds(probability: number): string {
  if (probability >= 1) return "Guaranteed";
  if (probability <= 0) return "-";
  const odds = Math.round(1 / probability);
  return `1 in ${odds}`;
}

export function PullRateTable({ rates, packsPerBox, setCode, language }: PullRateTableProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Pull Rates</h3>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">{setCode}</span>
          <span>{language}</span>
          <span>{packsPerBox} packs/box</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Rarity</TableHead>
              <TableHead className="text-right">Cards in Set</TableHead>
              <TableHead className="text-right">Per Pack</TableHead>
              <TableHead className="text-right">Per Box</TableHead>
              <TableHead className="text-right">Pack Odds</TableHead>
              <TableHead className="text-right">Box Chance</TableHead>
              <TableHead className="text-right">Specific Card / Box</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates.map((rate) => (
              <TableRow key={rate.rarity}>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      RARITY_COLORS[rate.rarity] ?? "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {rate.rarity}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{rate.uniqueCards}</TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {rate.perPack.toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {rate.perBox.toFixed(1)}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {formatOdds(rate.packProbability)}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {formatPct(rate.boxProbability)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {rate.perSpecificCardPerBox >= 1
                    ? rate.perSpecificCardPerBox.toFixed(1)
                    : formatOdds(rate.perSpecificCardPerBox)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-gray-400">
        Theoretical rates based on known pack structure. Actual results may vary. Not affiliated
        with Bandai or any TCG manufacturer.
      </p>
    </div>
  );
}
