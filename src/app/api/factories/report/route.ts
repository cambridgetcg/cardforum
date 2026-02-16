import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";

const reportSchema = z.object({
  tcg: z.enum(["POKEMON", "ONEPIECE", "YUGIOH", "MTG"]),
  setCode: z.string().min(1).max(20),
  setName: z.string().min(1).max(200),
  language: z.string().min(2).max(5),
  factoryName: z.string().min(1).max(200),
  factoryCountry: z.string().length(2).optional(),
  printingPeriod: z.string().max(100).optional(),
  evidence: z.array(z.string().url()).max(5).default([]),
  notes: z.string().max(2000).optional(),
});

const REPORT_RATE_LIMIT = { maxRequests: 10, windowMs: 15 * 60 * 1000 };

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await checkRateLimit(`factory-report:${ip}`, REPORT_RATE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many reports. Try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const body = await req.json();
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    tcg,
    setCode,
    setName,
    language,
    factoryName,
    factoryCountry,
    printingPeriod,
    evidence,
    notes,
  } = parsed.data;

  // Resolve or create factory
  const factoryCode = factoryName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+$/, "")
    .slice(0, 50);

  let factory = await db.printingFactory.findUnique({ where: { code: factoryCode } });

  if (!factory) {
    factory = await db.printingFactory.create({
      data: {
        name: factoryName,
        code: factoryCode,
        country: factoryCountry ?? "XX",
        tcgsSupported: [tcg],
        languagesSupported: [language],
        researchSources: evidence,
        confidence: "UNCONFIRMED",
      },
    });
  }

  // Upsert or increment production run
  const period = printingPeriod ?? "";

  const existing = await db.productionRun.findUnique({
    where: {
      tcg_setCode_language_factoryId_printingPeriod: {
        tcg,
        setCode,
        language,
        factoryId: factory.id,
        printingPeriod: period,
      },
    },
  });

  if (existing) {
    // Increment report count, merge evidence
    const mergedSources = Array.from(new Set([...existing.researchSources, ...evidence]));
    await db.productionRun.update({
      where: { id: existing.id },
      data: {
        reportCount: { increment: 1 },
        researchSources: mergedSources,
        researchNotes: notes
          ? existing.researchNotes
            ? `${existing.researchNotes}\n---\n${notes}`
            : notes
          : undefined,
      },
    });

    return NextResponse.json({
      status: "updated",
      productionRunId: existing.id,
      reportCount: existing.reportCount + 1,
    });
  }

  // Create new crowdsourced run
  const run = await db.productionRun.create({
    data: {
      tcg,
      setCode,
      setName,
      language,
      factoryId: factory.id,
      printingPeriod: period || null,
      researchSources: evidence,
      researchNotes: notes,
      confidence: "UNCONFIRMED",
      crowdsourced: true,
      reportCount: 1,
    },
  });

  return NextResponse.json(
    {
      status: "created",
      productionRunId: run.id,
      reportCount: 1,
    },
    { status: 201 },
  );
}
