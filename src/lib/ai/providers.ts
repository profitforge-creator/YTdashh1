import "server-only";
import { getServerEnv } from "@/lib/env";
import type { AiProvider } from "@/types/database";

export interface ProviderRequest {
  system: string;
  user: string;
  /** Enable the provider's web search tool for research calls. */
  search: boolean;
  maxTokens: number;
}

export class ProviderError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = "ProviderError";
  }
}

// Model ids are env-overridable so a deprecation never requires a code change.
const MODELS: Record<AiProvider, string> = {
  claude: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5",
  chatgpt: process.env.OPENAI_MODEL ?? "gpt-5",
  gemini: process.env.GEMINI_MODEL ?? "gemini-2.5-pro",
};

async function postJson(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const retryable = res.status === 429 || res.status >= 500;
      throw new ProviderError(`Provider returned ${res.status}`, retryable);
    }
    return await res.json();
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    throw new ProviderError("Provider request failed or timed out", true);
  } finally {
    clearTimeout(timer);
  }
}

function requireKey(key: string | undefined, name: string): string {
  if (!key) throw new ProviderError(`${name} is not configured on the server`, false);
  return key;
}

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
}
interface OpenAiResponse {
  output_text?: string;
  output?: { type: string; content?: { type: string; text?: string }[] }[];
}
interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

async function callClaude(req: ProviderRequest): Promise<string> {
  const key = requireKey(getServerEnv().ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY");
  const body: Record<string, unknown> = {
    model: MODELS.claude,
    max_tokens: req.maxTokens,
    system: req.system,
    messages: [{ role: "user", content: req.user }],
  };
  if (req.search) body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }];
  const json = (await postJson(
    "https://api.anthropic.com/v1/messages",
    { "x-api-key": key, "anthropic-version": "2023-06-01" },
    body,
    req.search ? 170_000 : 40_000,
  )) as AnthropicResponse;
  return (json.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
}

async function callOpenAi(req: ProviderRequest): Promise<string> {
  const key = requireKey(getServerEnv().OPENAI_API_KEY, "OPENAI_API_KEY");
  const body: Record<string, unknown> = {
    model: MODELS.chatgpt,
    instructions: req.system,
    input: req.user,
    max_output_tokens: req.maxTokens,
  };
  if (req.search) body.tools = [{ type: "web_search" }];
  const json = (await postJson(
    "https://api.openai.com/v1/responses",
    { authorization: `Bearer ${key}` },
    body,
    req.search ? 170_000 : 40_000,
  )) as OpenAiResponse;
  if (json.output_text) return json.output_text;
  return (json.output ?? [])
    .flatMap((o) => o.content ?? [])
    .filter((c) => c.type === "output_text")
    .map((c) => c.text ?? "")
    .join("");
}

async function callGemini(req: ProviderRequest): Promise<string> {
  const key = requireKey(getServerEnv().GEMINI_API_KEY, "GEMINI_API_KEY");
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: req.system }] },
    contents: [{ role: "user", parts: [{ text: req.user }] }],
    generationConfig: { maxOutputTokens: req.maxTokens },
  };
  if (req.search) body.tools = [{ google_search: {} }];
  const json = (await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.gemini}:generateContent`,
    { "x-goog-api-key": key },
    body,
    req.search ? 170_000 : 40_000,
  )) as GeminiResponse;
  return (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
}

export async function callProvider(provider: AiProvider, req: ProviderRequest): Promise<string> {
  const text = await (provider === "claude" ? callClaude(req) : provider === "chatgpt" ? callOpenAi(req) : callGemini(req));
  if (!text.trim()) throw new ProviderError("Provider returned an empty response", true);
  return text;
}

/** Extracts the first JSON object from a model reply, tolerating code fences and surrounding prose. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) throw new ProviderError("No JSON found in model reply", true);
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new ProviderError("Model returned malformed JSON", true);
  }
}
