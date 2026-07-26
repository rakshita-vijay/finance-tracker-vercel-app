import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-3.5-flash";
const MAX_WAIT_SECONDS = 25;

/**
 * Collects every configured Gemini key so calls can rotate across them.
 * Ported from the same scheme used in the article-title-generator project's
 * api/generate.py (_load_api_keys). Supports either:
 *   - GEMINI_API_KEY, GEMINI_API_KEY_2, GEMINI_API_KEY_3, GEMINI_API_KEY_4
 *     (separate env vars - keeps this project's existing GEMINI_API_KEY
 *     name as the primary/first key), or
 *   - GEMINI_API_KEYS as a comma-separated list.
 */
function loadApiKeys(): string[] {
  const keys: string[] = [];

  const combined = process.env.GEMINI_API_KEYS ?? "";
  if (combined) {
    for (const raw of combined.split(",")) {
      const k = raw.trim();
      if (k && !keys.includes(k)) keys.push(k);
    }
  }

  for (const name of ["GEMINI_API_KEY", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY_4"]) {
    const val = process.env[name];
    if (val && !keys.includes(val)) keys.push(val);
  }

  return keys;
}

const API_KEYS = loadApiKeys();

// Module-level so it persists across requests on a warm serverless instance,
// same idea as the Python version's module-level _key_cursor dict.
const keyCursor = { i: 0 };

/**
 * Returns all configured keys starting from the next one in rotation, so
 * consecutive requests spread across keys and a 429 can fall through to the
 * next key within the same request.
 */
function nextKeyOrder(): string[] {
  if (API_KEYS.length === 0) return [];
  const start = keyCursor.i % API_KEYS.length;
  keyCursor.i = (start + 1) % API_KEYS.length;
  return [...API_KEYS.slice(start), ...API_KEYS.slice(0, start)];
}

const clientCache = new Map<string, GoogleGenAI>();
function clientFor(apiKey: string): GoogleGenAI {
  let c = clientCache.get(apiKey);
  if (!c) {
    c = new GoogleGenAI({ apiKey });
    clientCache.set(apiKey, c);
  }
  return c;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function isQuotaError(err: unknown): boolean {
  return /429|quota|rate limit|resource_exhausted/i.test(errorMessage(err));
}

/**
 * Pulls the seconds out of Google's retry-delay field, falling back to
 * `defaultSeconds` if it's not present. Handles both the JSON error shape
 * the JS SDK surfaces ("retryDelay":"17s") and the older protobuf text
 * format (retry_delay { seconds: 17 }) just in case.
 */
function parseRetryDelaySeconds(message: string, defaultSeconds = 5, cap = MAX_WAIT_SECONDS): number {
  const jsonMatch = message.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s?"/i);
  if (jsonMatch) return Math.min(parseFloat(jsonMatch[1]), cap);
  const protoMatch = message.match(/retry_delay\s*{\s*seconds:\s*(\d+)/i);
  if (protoMatch) return Math.min(parseInt(protoMatch[1], 10), cap);
  return defaultSeconds;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type KeyAttemptResult<T> =
  | { ok: true; result: T }
  | { ok: false; error: unknown; timerStartMs: number | null };

/**
 * Tries every configured Gemini key for a single call. If a key is out of
 * quota (429), immediately falls through to the next key with no delay.
 *
 * The wait timer starts at the FIRST 429 in this pass (not after every key
 * has been tried), so by the time all keys have been exhausted, some of
 * Google's suggested retry delay has usually already elapsed just from
 * making those fallback calls - we only sleep the remainder.
 */
async function runWithKeyRotation<T>(fn: (ai: GoogleGenAI) => Promise<T>): Promise<T> {
  const keyOrder = nextKeyOrder();
  if (keyOrder.length === 0) {
    throw new Error(
      "No Gemini API key configured (GEMINI_API_KEY / GEMINI_API_KEY_2 / GEMINI_API_KEY_3 / GEMINI_API_KEY_4)."
    );
  }

  async function tryAllKeys(): Promise<KeyAttemptResult<T>> {
    let lastErr: unknown = null;
    let timerStartMs: number | null = null;
    for (const key of keyOrder) {
      try {
        const result = await fn(clientFor(key));
        return { ok: true, result };
      } catch (e) {
        if (isQuotaError(e)) {
          if (timerStartMs === null) timerStartMs = Date.now();
          lastErr = e;
          continue;
        }
        throw e;
      }
    }
    return { ok: false, error: lastErr, timerStartMs };
  }

  const first = await tryAllKeys();
  if (first.ok) return first.result;

  // Every key failed. Google told us roughly how long until quota frees up
  // (retryDelay); subtract the time we already spent trying the other keys
  // before we ever sleep.
  const requestedDelayMs = parseRetryDelaySeconds(errorMessage(first.error)) * 1000;
  const elapsedMs = first.timerStartMs !== null ? Date.now() - first.timerStartMs : 0;
  const remainingMs = Math.max(0, requestedDelayMs - elapsedMs);
  if (remainingMs > 0) await sleep(remainingMs);

  const second = await tryAllKeys();
  if (second.ok) return second.result;

  throw second.error ?? new Error("All Gemini API keys are out of quota.");
}

export async function callGemini(prompt: string): Promise<string> {
  return runWithKeyRotation(async (ai) => {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
    });
    return response.text ?? "";
  });
}

/**
 * Mirrors the `.strip('```').strip('markdown')` cleanup used throughout the
 * original CrewAI code (transform_csv_to_md_table.py, generate_report_from_csv.py).
 */
export function stripFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(markdown)?/i, "")
    .replace(/```$/i, "")
    .trim();
}
