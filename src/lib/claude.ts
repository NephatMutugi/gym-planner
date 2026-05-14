// Claude integration helper.
// Wraps the Anthropic SDK with a small abstraction so endpoints can
// gracefully degrade when ANTHROPIC_API_KEY is not configured.

import Anthropic from "@anthropic-ai/sdk";

const HAIKU = "claude-haiku-4-5-20251001";
const SONNET = "claude-sonnet-4-6";

let _client: Anthropic | null = null;

export function isClaudeConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

function client(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Add it to .env to enable Claude features."
      );
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export type ClaudeModel = "haiku" | "sonnet";

export async function complete({
  system,
  user,
  model = "haiku",
  maxTokens = 700,
}: {
  system: string;
  user: string;
  model?: ClaudeModel;
  maxTokens?: number;
}): Promise<string> {
  const c = client();
  const resp = await c.messages.create({
    model: model === "sonnet" ? SONNET : HAIKU,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  // Concatenate text blocks
  const text = resp.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n")
    .trim();
  return text;
}

// Helper to parse a JSON object out of a model response, tolerant of code fences
export function extractJson<T = unknown>(s: string): T | null {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : s;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Try to find the first { ... } block
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
