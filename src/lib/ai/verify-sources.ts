import "server-only";
import { ProviderError } from "./providers";
import type { ConceptSetDraft } from "./schemas";

const MIN_SOURCES = 2;

/**
 * Citation URLs come from model output, so treat them as hostile: https only, no IP literals,
 * no localhost/internal names. This blocks the obvious SSRF targets before we fetch anything.
 */
export function isSafePublicUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
  const host = u.hostname.toLowerCase();
  if (!host.includes(".") || /^\d+(\.\d+){3}$/.test(host) || host.startsWith("[")) return false;
  if (/(^|\.)(localhost|local|internal|lan|home|corp|intranet)$/.test(host)) return false;
  return true;
}

async function resolves(url: string): Promise<boolean> {
  if (!isSafePublicUrl(url)) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    let res = await fetch(url, { method: "HEAD", redirect: "manual", signal: controller.signal });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, { method: "GET", redirect: "manual", signal: controller.signal });
    }
    // 401/403/429 usually mean the site blocks bots, not that the page is missing.
    // Redirects are not followed (a redirect could point at an internal host); a 3xx proves the page exists.
    return res.ok || (res.status >= 300 && res.status < 400) || [401, 403, 429].includes(res.status);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function isFutureDate(date: string): boolean {
  return Date.parse(date) > Date.now() + 86_400_000;
}

export async function verifySources(draft: ConceptSetDraft): Promise<ConceptSetDraft> {
  const concepts = await Promise.all(
    draft.concepts.map(async (concept) => {
      const checks = await Promise.all(
        concept.sources.map(async (s) => (!isFutureDate(s.date) && (await resolves(s.url)) ? s : null)),
      );
      const sources = checks.filter((s): s is NonNullable<typeof s> => s !== null);
      if (sources.length < MIN_SOURCES) {
        throw new ProviderError(`Concept "${concept.title}" did not have enough verifiable sources`, false);
      }
      return { ...concept, sources };
    }),
  );
  return { concepts: [concepts[0], concepts[1], concepts[2]] as ConceptSetDraft["concepts"] };
}
