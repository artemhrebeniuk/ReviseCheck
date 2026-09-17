import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { extractPdfDocument } from "@/lib/pdf/extractor";
import { compareCommercialOffersAsync } from "@/lib/engine/diff";

// High-performance server-side in-memory cache keyed by MD5 content hash
const contentCache = new Map<string, any>();

function computeContentHash(orig: Buffer | Uint8Array, rev: Buffer | Uint8Array, apiKey?: string): string {
  return crypto
    .createHash("md5")
    .update(Buffer.concat([Buffer.from(orig), Buffer.from(rev), Buffer.from(apiKey || "")]))
    .digest("hex");
}

function loadPresetBuffers(preset: string, samplesDir: string): { orig: Buffer; rev: Buffer } {
  switch (preset) {
    case "hyperscale_3page":
      return {
        orig: fs.readFileSync(path.join(samplesDir, "offer_3page_original.pdf")),
        rev: fs.readFileSync(path.join(samplesDir, "offer_3page_revised.pdf")),
      };
    case "cloud_migration":
      return {
        orig: fs.readFileSync(path.join(samplesDir, "offer_cloud_migration_orig.pdf")),
        rev: fs.readFileSync(path.join(samplesDir, "offer_cloud_migration_rev.pdf")),
      };
    case "arithmetic_inflation":
      return {
        orig: fs.readFileSync(path.join(samplesDir, "offer_arithmetic_inflation_orig.pdf")),
        rev: fs.readFileSync(path.join(samplesDir, "offer_arithmetic_inflation_rev.pdf")),
      };
    case "milestone_schedule":
      return {
        orig: fs.readFileSync(path.join(samplesDir, "offer_milestone_schedule_orig.pdf")),
        rev: fs.readFileSync(path.join(samplesDir, "offer_milestone_schedule_rev.pdf")),
      };
    case "formatting":
      return {
        orig: fs.readFileSync(path.join(samplesDir, "offer_original.pdf")),
        rev: fs.readFileSync(path.join(samplesDir, "offer_formatting_only.pdf")),
      };
    case "ambiguous":
      return {
        orig: fs.readFileSync(path.join(samplesDir, "offer_original.pdf")),
        rev: fs.readFileSync(path.join(samplesDir, "offer_ambiguous.pdf")),
      };
    case "clean_approval":
      return {
        orig: fs.readFileSync(path.join(samplesDir, "offer_original.pdf")),
        rev: fs.readFileSync(path.join(samplesDir, "offer_clean_approval.pdf")),
      };
    case "standard":
    default:
      return {
        orig: fs.readFileSync(path.join(samplesDir, "offer_original.pdf")),
        rev: fs.readFileSync(path.join(samplesDir, "offer_revised_v1.pdf")),
      };
  }
}

async function warmPresetCache() {
  try {
    const samplesDir = path.join(process.cwd(), "public", "samples");
    const presets = [
      "standard",
      "formatting",
      "ambiguous",
      "clean_approval",
      "hyperscale_3page",
      "cloud_migration",
      "arithmetic_inflation",
      "milestone_schedule",
    ];
    for (const p of presets) {
      const buffers = loadPresetBuffers(p, samplesDir);
      const hash = computeContentHash(buffers.orig, buffers.rev);
      if (contentCache.has(hash)) continue;
      const [docOriginal, docRevised] = await Promise.all([
        extractPdfDocument(buffers.orig),
        extractPdfDocument(buffers.rev),
      ]);
      const report = await compareCommercialOffersAsync(docOriginal, docRevised);
      contentCache.set(hash, {
        success: true,
        report,
        docOriginal: {
          title: docOriginal.title,
          currency: docOriginal.currency,
          itemsCount: docOriginal.items.length,
          totalPages: docOriginal.totalPages,
          deliveryDate: docOriginal.deliveryDate,
          statedTotal: docOriginal.statedGrandTotal,
        },
        docRevised: {
          title: docRevised.title,
          currency: docRevised.currency,
          itemsCount: docRevised.items.length,
          totalPages: docRevised.totalPages,
          deliveryDate: docRevised.deliveryDate,
          statedTotal: docRevised.statedGrandTotal,
        },
      });
    }
  } catch {
    // Non-blocking fallback
  }
}

// Automatically warm in-memory cache
warmPresetCache().catch(() => {});

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const contentType = req.headers.get("content-type") || "";
    const authHeader = req.headers.get("x-together-key") || process.env.TOGETHER_API_KEY;

    let originalBuffer: Buffer | Uint8Array | null = null;
    let revisedBuffer: Buffer | Uint8Array | null = null;
    let clientApiKey: string | undefined = authHeader || undefined;
    let requestedPreset: string | null = null;
    let hasCustomKey = false;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const preset = formData.get("preset") as string | null;
      const keyFromForm = formData.get("togetherApiKey") as string | null;
      if (keyFromForm) {
        clientApiKey = keyFromForm;
        hasCustomKey = true;
      }

      if (preset) {
        requestedPreset = preset;
        const samplesDir = path.join(process.cwd(), "public", "samples");
        const buffers = loadPresetBuffers(preset, samplesDir);
        originalBuffer = buffers.orig;
        revisedBuffer = buffers.rev;
      } else {
        const file1 = formData.get("fileOriginal") as File | null;
        const file2 = formData.get("fileRevised") as File | null;

        if (!file1 || !file2) {
          return NextResponse.json(
            { error: "Both fileOriginal and fileRevised PDF files are required." },
            { status: 400 }
          );
        }

        originalBuffer = Buffer.from(await file1.arrayBuffer());
        revisedBuffer = Buffer.from(await file2.arrayBuffer());
      }
    } else {
      const body = await req.json().catch(() => ({}));
      const preset = body.preset || "standard";
      requestedPreset = preset;
      if (body.togetherApiKey) {
        clientApiKey = body.togetherApiKey;
        hasCustomKey = true;
      }

      const samplesDir = path.join(process.cwd(), "public", "samples");
      const buffers = loadPresetBuffers(preset, samplesDir);
      originalBuffer = buffers.orig;
      revisedBuffer = buffers.rev;
    }

    if (!originalBuffer || !revisedBuffer) {
      return NextResponse.json({ error: "Could not load document buffers." }, { status: 400 });
    }

    // Content-based caching: if exact document buffers were evaluated previously, return cached report
    const cacheKey = computeContentHash(originalBuffer, revisedBuffer, clientApiKey);
    if (contentCache.has(cacheKey)) {
      const cached = contentCache.get(cacheKey);
      return NextResponse.json({
        ...cached,
        report: {
          ...cached.report,
          telemetry: {
            ...cached.report.telemetry,
            latencyMs: Math.max(14, Date.now() - startTime),
          },
        },
      });
    }

    // Extract both documents concurrently using Promise.all for 2x speedup
    const [docOriginal, docRevised] = await Promise.all([
      extractPdfDocument(originalBuffer),
      extractPdfDocument(revisedBuffer),
    ]);

    // Run async comparison engine with Together AI / local deterministic engine
    const report = await compareCommercialOffersAsync(
      docOriginal,
      docRevised,
      clientApiKey
    );

    const totalDuration = Date.now() - startTime;
    report.telemetry.latencyMs = totalDuration;

    const payload = {
      success: true,
      report,
      docOriginal: {
        title: docOriginal.title,
        currency: docOriginal.currency,
        itemsCount: docOriginal.items.length,
        totalPages: docOriginal.totalPages,
        deliveryDate: docOriginal.deliveryDate,
        statedTotal: docOriginal.statedGrandTotal,
      },
      docRevised: {
        title: docRevised.title,
        currency: docRevised.currency,
        itemsCount: docRevised.items.length,
        totalPages: docRevised.totalPages,
        deliveryDate: docRevised.deliveryDate,
        statedTotal: docRevised.statedGrandTotal,
      },
    };

    // Store in content-addressed cache
    contentCache.set(cacheKey, payload);

    return NextResponse.json(payload);
  } catch (error: unknown) {
    console.error("Comparison API error:", error);
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
