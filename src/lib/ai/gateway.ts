import "server-only";
import { getServerEnv } from "@/lib/env";
import type { Answers, Route } from "@/lib/interview/schema";
import type { AiProvider } from "@/types/database";
import { fixtureConcepts, fixtureFollowUp } from "./fixtures";
import { CONCEPT_SYSTEM, conceptUserPrompt, FOLLOWUP_SYSTEM, followUpUserPrompt } from "./prompts";
import { callProvider, extractJson, ProviderError } from "./providers";
import { conceptSetSchema, followUpSchema, type ConceptSetDraft } from "./schemas";
import { verifySources } from "./verify-sources";

export interface GeneratedConcepts {
  draft: ConceptSetDraft;
  isFixture: boolean;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Calls the provider and validates against the schema. One repair attempt with the validation error appended. */
async function structured<T>(
  provider: AiProvider,
  system: string,
  user: string,
  parse: (raw: unknown) => { success: true; data: T } | { success: false; error: { message: string } },
  opts: { search: boolean; maxTokens: number },
): Promise<T> {
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = attempt === 0 ? user : `${user}\n\nYour previous reply was invalid: ${lastError}\nReturn corrected JSON only.`;
    try {
      const text = await callProvider(provider, { system, user: prompt, ...opts });
      const result = parse(extractJson(text));
      if (result.success) return result.data;
      lastError = result.error.message.slice(0, 600);
    } catch (err) {
      if (err instanceof ProviderError && !err.retryable) throw err;
      lastError = err instanceof Error ? err.message : "unknown error";
    }
  }
  throw new ProviderError(`The AI response could not be validated: ${lastError}`, false);
}

export async function generateConcepts(
  provider: AiProvider,
  route: Route,
  answers: Answers,
  revisionNote?: string | null,
): Promise<GeneratedConcepts> {
  if (getServerEnv().AI_MODE === "fixtures") {
    return { draft: fixtureConcepts(answers, todayIso(), revisionNote), isFixture: true };
  }

  const draft = await structured(
    provider,
    CONCEPT_SYSTEM,
    conceptUserPrompt(route, answers, revisionNote),
    (raw) => conceptSetSchema.safeParse(raw),
    { search: true, maxTokens: 12_000 },
  );

  // Reject concepts whose citations don't resolve, rather than showing unverifiable research.
  const verified = await verifySources(draft);
  return { draft: verified, isFixture: false };
}

export async function generateFollowUp(provider: AiProvider, route: Route, answers: Answers): Promise<string | null> {
  if (getServerEnv().AI_MODE === "fixtures") return fixtureFollowUp(answers);
  const result = await structured(
    provider,
    FOLLOWUP_SYSTEM,
    followUpUserPrompt(route, answers),
    (raw) => followUpSchema.safeParse(raw),
    { search: false, maxTokens: 400 },
  );
  return result.follow_up?.trim() || null;
}
