/**
 * Pull Rate Report Generation (Stage 6)
 *
 * Generates markdown reports from all computed pull rate and EV data.
 *
 * Per-set report includes:
 *   - Pack structure diagram (ASCII)
 *   - Pull rate table per rarity
 *   - EV breakdown table
 *   - Box value assessment
 *   - EN vs JP comparison
 *
 * Cross-set summary includes:
 *   - Set-over-set EV trends
 *   - Best/worst value sets
 *   - Rarity comparison across sets
 *
 * Usage:
 *   npx tsx research/pipeline/pullrates-report.ts --tcg onepiece --set OP01
 *   npx tsx research/pipeline/pullrates-report.ts --tcg onepiece --all
 *   npx tsx research/pipeline/pullrates-report.ts --tcg onepiece --all --dry-run
 */

import * as fs from "fs";
import * as path from "path";
import type { TCG } from "./types";
import type {
  BoxLanguage,
  PullRateReport,
  EVReport,
  PullRateValidation,
} from "./pullrates-types";
import { getAvailableSetCodes, getBoxConfig } from "./pullrates-box-structures";

// ── Directory Helpers ─────────────────────────────────────────

const TCG_DIR_MAP: Record<TCG, string> = {
  onepiece: "onepiece",
  pokemon: "pokemon",
  yugioh: "yugioh",
  mtg: "mtg",
};

function getDataDir(tcg: TCG): string {
  return path.join(process.cwd(), "research", TCG_DIR_MAP[tcg]);
}

function loadJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function loadPullRates(tcg: TCG, setCode: string, language: BoxLanguage): PullRateReport | null {
  return loadJson(path.join(getDataDir(tcg), `pullrates-${setCode}-${language}.json`));
}

function loadEVReport(tcg: TCG, setCode: string, language: BoxLanguage): EVReport | null {
  return loadJson(path.join(getDataDir(tcg), `ev-report-${setCode}-${language}.json`));
}

function loadValidation(tcg: TCG, setCode: string): PullRateValidation | null {
  return loadJson(path.join(getDataDir(tcg), `pullrates-validation-${setCode}.json`));
}

// ── Formatting Helpers ────────────────────────────────────────

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function pad(s: string, n: number): string {
  return s.padEnd(n);
}

// ── Pack Structure Diagram ────────────────────────────────────

function renderPackStructure(tcg: TCG, setCode: string, language: BoxLanguage): string {
  const box = getBoxConfig(tcg, setCode, language);
  if (!box) return "_No box config available._\n";

  const lines: string[] = [];
  lines.push("```");
  lines.push(`${box.packsPerBox} packs/box × ${box.packConfig.cardsPerPack} cards/pack = ${box.packsPerBox * box.packConfig.cardsPerPack} cards/box`);
  lines.push("");

  for (const variant of box.packConfig.variants) {
    const totalWeight = box.packConfig.variants.reduce((a, v) => a + v.weight, 0);
    const variantPct = totalWeight > 0 ? (variant.weight / totalWeight * 100).toFixed(1) : "100";
    lines.push(`Pack Variant: "${variant.name}" (${variantPct}% of packs)`);
    lines.push("┌────────────────────────────────────────┐");

    for (const slot of variant.slots) {
      const sheet = box.packConfig.sheets[slot.sheetName];
      const sheetDesc = sheet
        ? Object.entries(sheet.rarityWeights)
            .sort((a, b) => b[1] - a[1])
            .map(([r, w]) => {
              const total = Object.values(sheet.rarityWeights).reduce((a, b) => a + b, 0);
              return `${r}:${(w / total * 100).toFixed(0)}%`;
            })
            .join(" ")
        : "???";
      const foilTag = sheet?.foil ? " [FOIL]" : "";
      lines.push(`│ ${slot.count}× ${slot.name.padEnd(20)} → ${sheetDesc}${foilTag}`);
    }

    lines.push("└────────────────────────────────────────┘");
    lines.push("");
  }

  if (box.boxGuarantees.length > 0) {
    lines.push("Box Guarantees:");
    for (const g of box.boxGuarantees) {
      lines.push(`  - At least ${g.minPerBox}× ${g.rarity} per box`);
    }
  }

  lines.push("```");
  return lines.join("\n");
}

// ── Per-Set Report ────────────────────────────────────────────

function generateSetReport(tcg: TCG, setCode: string): string {
  const lines: string[] = [];

  lines.push(`# Pull Rate Report: ${tcg.toUpperCase()} — ${setCode}`);
  lines.push("");
  lines.push(`_Generated: ${new Date().toISOString().split("T")[0]}_`);
  lines.push("");

  // EN report
  const enReport = loadPullRates(tcg, setCode, "EN");
  const enEV = loadEVReport(tcg, setCode, "EN");
  const jpReport = loadPullRates(tcg, setCode, "JP");
  const jpEV = loadEVReport(tcg, setCode, "JP");
  const validation = loadValidation(tcg, setCode);

  // Pack Structure
  lines.push("## Pack Structure");
  lines.push("");
  lines.push("### EN Booster Box");
  lines.push(renderPackStructure(tcg, setCode, "EN"));

  if (jpReport) {
    lines.push("### JP Booster Box");
    lines.push(renderPackStructure(tcg, setCode, "JP"));
  }

  // Pull Rate Table
  if (enReport) {
    lines.push("## Pull Rates (EN)");
    lines.push("");
    lines.push("| Rarity | Unique Cards | Per Pack | Per Box | Pack Prob | Box Prob | Per Specific Card/Box |");
    lines.push("|--------|-------------|----------|---------|-----------|----------|-----------------------|");

    for (const r of enReport.rates) {
      lines.push(
        `| ${pad(r.rarity, 6)} | ${String(r.uniqueCards).padStart(11)} | ` +
        `${r.perPack.toFixed(3).padStart(8)} | ${r.perBox.toFixed(2).padStart(7)} | ` +
        `${pct(r.packProbability).padStart(9)} | ${pct(r.boxProbability).padStart(8)} | ` +
        `${r.perSpecificCardPerBox.toFixed(4).padStart(21)} |`,
      );
    }
    lines.push("");
  }

  if (jpReport) {
    lines.push("## Pull Rates (JP)");
    lines.push("");
    lines.push("| Rarity | Unique Cards | Per Pack | Per Box | Pack Prob | Box Prob | Per Specific Card/Box |");
    lines.push("|--------|-------------|----------|---------|-----------|----------|-----------------------|");

    for (const r of jpReport.rates) {
      lines.push(
        `| ${pad(r.rarity, 6)} | ${String(r.uniqueCards).padStart(11)} | ` +
        `${r.perPack.toFixed(3).padStart(8)} | ${r.perBox.toFixed(2).padStart(7)} | ` +
        `${pct(r.packProbability).padStart(9)} | ${pct(r.boxProbability).padStart(8)} | ` +
        `${r.perSpecificCardPerBox.toFixed(4).padStart(21)} |`,
      );
    }
    lines.push("");
  }

  // EN vs JP Comparison
  if (enReport && jpReport) {
    lines.push("## EN vs JP Comparison");
    lines.push("");
    lines.push("| Rarity | EN Per Box | JP Per Box | JP Advantage |");
    lines.push("|--------|-----------|-----------|-------------|");

    const allRarities = [
      ...new Set([
        ...enReport.rates.map((r) => r.rarity),
        ...jpReport.rates.map((r) => r.rarity),
      ]),
    ];

    for (const rarity of allRarities) {
      const en = enReport.ratesByRarity[rarity];
      const jp = jpReport.ratesByRarity[rarity];
      if (!en && !jp) continue;

      const enPerBox = en?.perBox ?? 0;
      const jpPerBox = jp?.perBox ?? 0;
      const advantage = enPerBox > 0 ? ((jpPerBox - enPerBox) / enPerBox * 100).toFixed(1) : "N/A";

      lines.push(
        `| ${pad(rarity, 6)} | ${enPerBox.toFixed(2).padStart(9)} | ${jpPerBox.toFixed(2).padStart(9)} | ` +
        `${typeof advantage === "string" ? advantage : `${advantage}%`} |`,
      );
    }
    lines.push("");
  }

  // EV Breakdown
  if (enEV) {
    lines.push("## Expected Value (EN)");
    lines.push("");
    lines.push(`**Total EV: ${dollars(enEV.totalEVCents)}**`);
    if (enEV.boxPriceCents) {
      lines.push(`**Box Price: ${dollars(enEV.boxPriceCents)}**`);
      lines.push(`**EV Ratio: ${enEV.evRatio?.toFixed(2)}x** ${enEV.evRatio && enEV.evRatio >= 1 ? "(positive)" : "(negative)"}`);
    }
    lines.push("");
    lines.push(`_Price source: ${enEV.priceSource}_`);
    lines.push("");
    lines.push("| Rarity | Expected/Box | Avg Price | Median Price | EV Contribution | EV Share |");
    lines.push("|--------|-------------|-----------|-------------|----------------|----------|");

    for (const b of enEV.breakdown.filter((b) => b.evContribution > 0)) {
      lines.push(
        `| ${pad(b.rarity, 6)} | ${b.expectedPerBox.toFixed(2).padStart(11)} | ` +
        `${dollars(b.avgCardPrice).padStart(9)} | ${dollars(b.medianCardPrice).padStart(11)} | ` +
        `${dollars(b.evContribution).padStart(14)} | ${pct(b.evShare).padStart(8)} |`,
      );
    }
    lines.push("");
  }

  if (jpEV) {
    lines.push("## Expected Value (JP)");
    lines.push("");
    lines.push(`**Total EV: ${dollars(jpEV.totalEVCents)}**`);
    if (jpEV.boxPriceCents) {
      lines.push(`**Box Price: ${dollars(jpEV.boxPriceCents)}**`);
      lines.push(`**EV Ratio: ${jpEV.evRatio?.toFixed(2)}x**`);
    }
    lines.push("");
  }

  // Validation
  if (validation) {
    lines.push("## Community Validation");
    lines.push("");
    lines.push(`**Overall Assessment: ${validation.overallAssessment}**`);
    lines.push("");

    if (validation.sources.length > 0) {
      lines.push("Sources:");
      for (const s of validation.sources) {
        lines.push(`- ${s.name}${s.sampleSize ? ` (n=${s.sampleSize})` : ""}${s.url ? ` — ${s.url}` : ""}`);
      }
      lines.push("");
    }

    const tested = validation.results.filter((r) => r.observedRate !== null);
    if (tested.length > 0) {
      lines.push("| Rarity | Theoretical | Observed | Deviation | p-value | Status |");
      lines.push("|--------|------------|----------|-----------|---------|--------|");

      for (const r of tested) {
        const status = r.significant ? "SIGNIFICANT" : "OK";
        lines.push(
          `| ${pad(r.rarity, 6)} | ${r.theoreticalRate.toFixed(2).padStart(10)} | ` +
          `${r.observedRate!.toFixed(2).padStart(8)} | ` +
          `${r.deviation! > 0 ? "+" : ""}${r.deviation!.toFixed(2).padStart(8)} | ` +
          `${r.pValue!.toFixed(4).padStart(7)} | ${status} |`,
        );
      }
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("_Generated by CardForum Pull Rate Pipeline_");
  lines.push("");

  return lines.join("\n");
}

// ── Cross-Set Summary ─────────────────────────────────────────

function generateSummary(tcg: TCG, setCodes: string[]): string {
  const lines: string[] = [];

  lines.push(`# Pull Rate Summary: ${tcg.toUpperCase()}`);
  lines.push("");
  lines.push(`_Generated: ${new Date().toISOString().split("T")[0]}_`);
  lines.push(`_Sets: ${setCodes.join(", ")}_`);
  lines.push("");

  // EV Comparison Table
  lines.push("## Box EV Comparison");
  lines.push("");
  lines.push("| Set | Total EV | Box Price | EV Ratio | Price Source |");
  lines.push("|-----|----------|-----------|----------|-------------|");

  const evData: Array<{ setCode: string; ev: EVReport }> = [];

  for (const setCode of setCodes) {
    const ev = loadEVReport(tcg, setCode, "EN");
    if (ev) {
      evData.push({ setCode, ev });
      lines.push(
        `| ${setCode} | ${dollars(ev.totalEVCents)} | ` +
        `${ev.boxPriceCents ? dollars(ev.boxPriceCents) : "N/A"} | ` +
        `${ev.evRatio ? ev.evRatio.toFixed(2) + "x" : "N/A"} | ` +
        `${ev.priceSource} |`,
      );
    }
  }
  lines.push("");

  // Best/Worst Sets
  if (evData.length > 0) {
    const sorted = [...evData].sort((a, b) => b.ev.totalEVCents - a.ev.totalEVCents);
    lines.push("## Best & Worst Value");
    lines.push("");
    lines.push(`**Highest EV:** ${sorted[0].setCode} — ${dollars(sorted[0].ev.totalEVCents)}`);
    lines.push(`**Lowest EV:** ${sorted[sorted.length - 1].setCode} — ${dollars(sorted[sorted.length - 1].ev.totalEVCents)}`);

    const withRatio = evData.filter((d) => d.ev.evRatio !== null);
    if (withRatio.length > 0) {
      const sortedRatio = [...withRatio].sort((a, b) => (b.ev.evRatio ?? 0) - (a.ev.evRatio ?? 0));
      lines.push(`**Best EV Ratio:** ${sortedRatio[0].setCode} — ${sortedRatio[0].ev.evRatio!.toFixed(2)}x`);
      lines.push(`**Worst EV Ratio:** ${sortedRatio[sortedRatio.length - 1].setCode} — ${sortedRatio[sortedRatio.length - 1].ev.evRatio!.toFixed(2)}x`);
    }
    lines.push("");
  }

  // Pull Rate Comparison (key rarities)
  lines.push("## Pull Rate Comparison");
  lines.push("");

  // Find key rarities across all sets
  const keyRarities = tcg === "onepiece" ? ["SR", "SEC", "L"]
    : tcg === "pokemon" ? ["UR", "SAR", "SIR"]
    : tcg === "yugioh" ? ["UR", "SCRT", "STARLIGHT"]
    : ["MR", "R"];

  for (const rarity of keyRarities) {
    lines.push(`### ${rarity} Per Box`);
    lines.push("");
    lines.push("| Set | EN Per Box | JP Per Box | Per Specific Card |");
    lines.push("|-----|-----------|-----------|------------------|");

    for (const setCode of setCodes) {
      const en = loadPullRates(tcg, setCode, "EN");
      const jp = loadPullRates(tcg, setCode, "JP");
      const enRate = en?.ratesByRarity[rarity];
      const jpRate = jp?.ratesByRarity[rarity];

      if (!enRate && !jpRate) continue;

      lines.push(
        `| ${setCode} | ${enRate ? enRate.perBox.toFixed(2) : "N/A"} | ` +
        `${jpRate ? jpRate.perBox.toFixed(2) : "N/A"} | ` +
        `${enRate ? enRate.perSpecificCardPerBox.toFixed(4) : "N/A"} |`,
      );
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("_Generated by CardForum Pull Rate Pipeline_");
  lines.push("");

  return lines.join("\n");
}

// ── Main Entry ────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const tcg = (args.find((a, i) => args[i - 1] === "--tcg") ?? "onepiece") as TCG;
  const setArg = args.find((a, i) => args[i - 1] === "--set");
  const isAll = args.includes("--all");
  const isDryRun = args.includes("--dry-run");

  const setCodes = isAll
    ? getAvailableSetCodes(tcg)
    : setArg
      ? [setArg]
      : [];

  if (setCodes.length === 0) {
    console.error("Usage: --tcg <tcg> --set <code> OR --tcg <tcg> --all");
    process.exit(1);
  }

  console.log(`\n=== Pull Rate Report Generation ===`);
  console.log(`TCG: ${tcg}, Sets: ${setCodes.join(", ")}`);

  const dir = getDataDir(tcg);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Per-set reports
  for (const setCode of setCodes) {
    console.log(`\nGenerating report for ${setCode}...`);
    const report = generateSetReport(tcg, setCode);

    if (!isDryRun) {
      const outPath = path.join(dir, `pullrates-report-${setCode}.md`);
      fs.writeFileSync(outPath, report);
      console.log(`  → Saved to ${path.relative(process.cwd(), outPath)}`);
    } else {
      console.log(`  [dry-run] Would save report for ${setCode}`);
    }
  }

  // Cross-set summary (only if multiple sets)
  if (setCodes.length > 1) {
    console.log(`\nGenerating cross-set summary...`);
    const summary = generateSummary(tcg, setCodes);

    if (!isDryRun) {
      const outPath = path.join(dir, `pullrates-summary.md`);
      fs.writeFileSync(outPath, summary);
      console.log(`  → Saved to ${path.relative(process.cwd(), outPath)}`);
    } else {
      console.log(`  [dry-run] Would save summary`);
    }
  }

  console.log(`\n=== Done ===\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
