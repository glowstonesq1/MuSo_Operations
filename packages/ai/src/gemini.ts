import { createHash } from "crypto";
import type { AiFeature } from "./prompts";

/**
 * Gemini 2.0 Flash wrapper with the spec's guardrails:
 * - response cache keyed by (feature, sha256(input)) in the ai_cache table
 * - daily budget cap (AI_DAILY_BUDGET_CALLS, default 500) with rule-based fallback
 * - every real call logged to ai_call_log with token counts
 * Server-side only (route handlers) — the key never reaches the browser.
 */

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// minimal shape of the Supabase client we need (avoids a hard dependency)
export interface DbClient {
  from(table: string): any;
}

export interface AiResult<T = string> {
  ok: boolean;
  cached: boolean;
  budgetExceeded?: boolean;
  data?: T;
  error?: string;
}

export function hashInput(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export async function callGemini(opts: {
  db: DbClient;
  feature: AiFeature;
  prompt: string;
  userId?: string | null;
  bookingId?: string | null;
  expectJson?: boolean;
}): Promise<AiResult> {
  const { db, feature, prompt } = opts;
  const inputHash = hashInput(prompt);

  // 1) cache
  const { data: hit } = await db
    .from("ai_cache")
    .select("response")
    .eq("feature", feature)
    .eq("input_hash", inputHash)
    .maybeSingle();
  if (hit?.response?.text != null) {
    await db.from("ai_call_log").insert({
      called_by: opts.userId ?? null,
      feature,
      cached: true,
      booking_id: opts.bookingId ?? null,
    });
    return { ok: true, cached: true, data: hit.response.text };
  }

  // 2) daily budget
  const budget = Number(process.env.AI_DAILY_BUDGET_CALLS ?? 500);
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { count } = await db
    .from("ai_call_log")
    .select("id", { count: "exact", head: true })
    .eq("cached", false)
    .gte("called_at", since.toISOString());
  if ((count ?? 0) >= budget) {
    return { ok: false, cached: false, budgetExceeded: true, error: "Daily AI budget exhausted; using rule-based defaults." };
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, cached: false, error: "GEMINI_API_KEY is not configured." };

  // 3) real call
  const res = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: opts.expectJson ? { responseMimeType: "application/json" } : {},
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    return { ok: false, cached: false, error: `Gemini API ${res.status}: ${body.slice(0, 300)}` };
  }
  const json = await res.json();
  const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return { ok: false, cached: false, error: "Empty Gemini response." };

  const usage = json?.usageMetadata ?? {};
  await db.from("ai_call_log").insert({
    called_by: opts.userId ?? null,
    feature,
    input_tokens: usage.promptTokenCount ?? null,
    output_tokens: usage.candidatesTokenCount ?? null,
    cached: false,
    booking_id: opts.bookingId ?? null,
  });
  await db.from("ai_cache").upsert({ feature, input_hash: inputHash, response: { text } });

  return { ok: true, cached: false, data: text };
}

/** Strip markdown fences and parse JSON from a model reply. */
export function parseModelJson<T>(text: string): T | null {
  try {
    const cleaned = text.replace(/^```(?:json)?\s*/m, "").replace(/```\s*$/m, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}
