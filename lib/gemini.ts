import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (client) return client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set.");
  }
  client = new GoogleGenAI({ apiKey });
  return client;
}

export async function callGemini(prompt: string): Promise<string> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
  });
  return response.text ?? "";
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
