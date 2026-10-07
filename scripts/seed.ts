/**
 * Idempotent seed: official DevMint content, demo profiles, example jobs/posts, and one complete demo
 * account with an approved example project and 30 days of metrics. Safe to re-run.
 *
 *   npm run seed            (reads .env.local)
 *
 * Demo creators get random passwords nobody knows; only the demo account can sign in, using SEED_DEMO_PASSWORD.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { randomBytes } from "node:crypto";
import { fixtureConcepts } from "../src/lib/ai/fixtures";
import { confidenceFor, explainScore, opportunityScore } from "../src/lib/ai/opportunity";
import { buildSummary, type Answers } from "../src/lib/interview/schema";
import { computeRank, deriveSpecialties } from "../src/lib/rank/score";
import type { AppRole, Database, Json } from "../src/types/database";

config({ path: ".env.local" });
config();

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}. Set it in .env.local.`);
  return v;
}

const admin: SupabaseClient<Database> = createClient<Database>(need("NEXT_PUBLIC_SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DEMO_EMAIL = process.env.SEED_DEMO_EMAIL ?? "demo@devmint.example";
const DEMO_PASSWORD = need("SEED_DEMO_PASSWORD");
if (DEMO_PASSWORD.length < 12) throw new Error("SEED_DEMO_PASSWORD must be at least 12 characters.");

// Fixed ids make every insert an upsert.
const uuid = (prefix: string, n: number) => {
  const hex = (prefix + "00000000").slice(0, 8);
  return `${hex}-0000-4000-8000-${String(n).padStart(12, "0")}`;
};

interface SeedUser {
  key: string;
  email: string;
  password: string;
  display_name: string;
  handle: string;
  bio: string;
  roles: AppRole[];
  skills: string[];
  genres: string[];
  flags: { is_official?: boolean; is_demo?: boolean };
  rankPoints: { component: "game_performance" | "projects" | "paid_work" | "community" | "activity"; points: number; daysAgo: number }[];
}

const randomPassword = () => randomBytes(24).toString("base64url");

const USERS: SeedUser[] = [
  {
    key: "official", email: "official@devmint.example", password: randomPassword(), display_name: "DevMint", handle: "devmint",
    bio: "Official updates, example projects and sample jobs from the DevMint team.", roles: ["developer"], skills: ["Game design"],
    genres: ["Simulator"], flags: { is_official: true }, rankPoints: [],
  },
  {
    key: "demo", email: DEMO_EMAIL, password: DEMO_PASSWORD, display_name: "Demo Developer", handle: "demodev",
    bio: "A complete demo account: an approved project, 30 days of metrics and open jobs.", roles: ["developer", "tester"],
    skills: ["Game design", "QA testing"], genres: ["Tower Defense", "Simulator"], flags: { is_demo: true },
    rankPoints: [
      { component: "projects", points: 30, daysAgo: 12 }, { component: "paid_work", points: 20, daysAgo: 20 },
      { component: "community", points: 18, daysAgo: 5 }, { component: "activity", points: 8, daysAgo: 2 },
    ],
  },
  {
    key: "luau", email: "luau.larry@demo.devmint.example", password: randomPassword(), display_name: "Larry Luau", handle: "larryluau",
    bio: "Scripter. Combat systems, data stores, clean modules.", roles: ["specialist"], skills: ["Luau scripting"],
    genres: ["RPG", "Fighting"], flags: { is_demo: true },
    rankPoints: [
      { component: "paid_work", points: 90, daysAgo: 15 }, { component: "paid_work", points: 40, daysAgo: 40 },
      { component: "community", points: 50, daysAgo: 9 }, { component: "projects", points: 40, daysAgo: 30 },
      { component: "game_performance", points: 60, daysAgo: 25 }, { component: "activity", points: 20, daysAgo: 1 },
    ],
  },
  {
    key: "builder", email: "maya.maps@demo.devmint.example", password: randomPassword(), display_name: "Maya Maps", handle: "mayamaps",
    bio: "Map builder: readable layouts and strong first impressions.", roles: ["specialist"], skills: ["Map building", "UI design"],
    genres: ["Obby", "Tycoon"], flags: { is_demo: true },
    rankPoints: [
      { component: "paid_work", points: 60, daysAgo: 10 }, { component: "projects", points: 50, daysAgo: 22 },
      { component: "community", points: 35, daysAgo: 6 }, { component: "activity", points: 14, daysAgo: 3 },
    ],
  },
  {
    key: "artist", email: "theo.thumbs@demo.devmint.example", password: randomPassword(), display_name: "Theo Thumbs", handle: "theothumbs",
    bio: "Thumbnails and key art that get clicks.", roles: ["specialist"], skills: ["Thumbnails", "3D modeling"],
    genres: ["Anime", "Simulator"], flags: { is_demo: true },
    rankPoints: [
      { component: "paid_work", points: 45, daysAgo: 18 }, { component: "community", points: 40, daysAgo: 4 },
      { component: "activity", points: 10, daysAgo: 7 },
    ],
  },
  {
    key: "tester", email: "tess.tester@demo.devmint.example", password: randomPassword(), display_name: "Tess Tester", handle: "tesstester",
    bio: "Playtester with a bug-report template that developers love.", roles: ["tester", "player"], skills: ["QA testing"],
    genres: ["Horror", "Obby"], flags: { is_demo: true },
    rankPoints: [
      { component: "paid_work", points: 70, daysAgo: 8 }, { component: "community", points: 12, daysAgo: 11 },
      { component: "activity", points: 9, daysAgo: 1 },
    ],
  },
  {
    key: "newbie", email: "nico.newbie@demo.devmint.example", password: randomPassword(), display_name: "Nico Newbie", handle: "niconewbie",
    bio: "Learning Roblox dev one weekend at a time.", roles: ["player", "developer"], skills: [],
    genres: ["Obby"], flags: { is_demo: true }, rankPoints: [{ component: "activity", points: 2, daysAgo: 1 }],
  },
];

async function ensureAuthUser(u: SeedUser): Promise<string> {
  // Look for an existing profile first so re-runs never recreate or reset passwords.
  const { data: existing } = await admin.from("profiles").select("id").eq("handle", u.handle).maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await admin.auth.admin.createUser({
    email: u.email, password: u.password, email_confirm: true, user_metadata: { full_name: u.display_name },
  });
  if (error || !data.user) {
    // The auth user may exist without our handle (e.g. created by hand): adopt it.
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const found = list.data.users.find((x) => x.email === u.email);
    if (!found) throw new Error(`Could not create ${u.email}: ${error?.message ?? "unknown error"}`);
    return found.id;
  }
  return data.user.id;
}

async function seedUsers(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const u of USERS) {
    const userId = await ensureAuthUser(u);
    ids.set(u.key, userId);
    const { error } = await admin.from("profiles").update({
      handle: u.handle, display_name: u.display_name, bio: u.bio, roles: u.roles, skills: u.skills, genres: u.genres,
      experience_level: "intermediate", dm_policy: u.key === "official" ? "requests" : "open", ...u.flags,
    }).eq("id", userId);
    if (error) throw new Error(`profile ${u.handle}: ${error.message}`);
    await admin.from("user_preferences").update({
      goals: ["Ship my first game"], weekly_hours: 10, budget_usd: 100, onboarded_at: new Date().toISOString(),
    }).eq("user_id", userId);

    const events = u.rankPoints.map((p, i) => ({
      user_id: userId, component: p.component, kind: "seed", points: p.points,
      dedupe_key: `seed:${u.handle}:${i}`, created_at: new Date(Date.now() - p.daysAgo * 86_400_000).toISOString(),
    }));
    if (events.length) await admin.from("rank_events").upsert(events, { onConflict: "dedupe_key", ignoreDuplicates: true });

    const rank = computeRank(events.map((e) => ({ component: e.component, points: e.points, created_at: e.created_at })));
    await admin.from("rank_snapshots").upsert({
      user_id: userId, score: rank.score, tier: rank.tier, components: rank.components as unknown as Json,
      specialties: deriveSpecialties(u.roles, u.skills, rank.tier), computed_at: new Date().toISOString(),
    });
  }
  return ids;
}

async function seedPosts(users: Map<string, string>): Promise<void> {
  const posts: { n: number; who: string; body: string; official?: boolean; hoursAgo: number }[] = [
    { n: 1, who: "official", official: true, hoursAgo: 2, body: "Welcome to the DevMint closed beta! Start in Build to run the AI interview, research three concepts, and approve one. Work and Feed are live too." },
    { n: 2, who: "official", official: true, hoursAgo: 20, body: "Example project: 'Tower Defense Fresh Take' went from interview to an approved concept in about 12 minutes. Open the demo profile to see the full flow." },
    { n: 3, who: "official", official: true, hoursAgo: 50, body: "Payments run in test mode during the beta: fund a job, submit evidence, approve, and watch the DevMint Balance states change. No real money moves." },
    { n: 4, who: "luau", hoursAgo: 6, body: "Finished a modular combat system with hit-stop and a clean client/server split. Happy to take another scripting job this week." },
    { n: 5, who: "builder", hoursAgo: 10, body: "Before/after of a hub map: players now find the first objective in under 10 seconds. Layout beats decoration every time." },
    { n: 6, who: "tester", hoursAgo: 14, body: "Looking for obbies to playtest. I write structured reports with repro steps and screen recordings." },
    { n: 7, who: "artist", hoursAgo: 30, body: "New thumbnail pack for simulator games. Bold subject, one color pop, readable at phone size." },
    { n: 8, who: "demo", hoursAgo: 4, body: "Locked in my concept for the tower defense. Retention numbers on the prototype are looking decent already." },
    { n: 9, who: "newbie", hoursAgo: 40, body: "Day 3 of learning Luau. Made a part change color when touched. Tiny win!" },
  ];
  for (const p of posts) {
    const author = users.get(p.who);
    if (!author) continue;
    const { error } = await admin.from("posts").upsert({
      id: uuid("a1b2c3d4", p.n), author_id: author, body: p.body, kind: "text", is_official: p.official ?? false,
      created_at: new Date(Date.now() - p.hoursAgo * 3_600_000).toISOString(),
    });
    if (error) throw new Error(`post ${p.n}: ${error.message}`);
  }
}

async function seedJobs(users: Map<string, string>): Promise<void> {
  const owner = users.get("official");
  const demo = users.get("demo");
  if (!owner || !demo) return;
  const jobs = [
    { n: 1, owner, official: true, title: "Playtest my obby (30 min)", category: "tester" as const, session: 30, pay: 1500, slots: 3,
      deliver: "A written report with at least 5 findings and a screen recording of your session.", accept: "Each finding has steps to reproduce; the recording covers the full session." },
    { n: 2, owner, official: true, title: "Polish the starter hub map", category: "map_builder" as const, session: null, pay: 6000, slots: 1,
      deliver: "A reworked hub with clear sightlines to the first objective, lighting pass included.", accept: "A new player finds the first objective in under 15 seconds in a playtest." },
    { n: 3, owner, official: true, title: "Thumbnail for a simulator launch", category: "thumbnail_artist" as const, session: null, pay: 3500, slots: 1,
      deliver: "Three thumbnail concepts and one final at 1920x1080, plus the layered source file.", accept: "Readable at phone size; title area kept clear." },
    { n: 4, owner: demo, official: false, title: "Script the wave spawner module", category: "scripter" as const, session: null, pay: 8000, slots: 1,
      deliver: "A ModuleScript that spawns configurable waves with unit tests or a test place.", accept: "Config-driven, no hard-coded enemy lists, and works in a live server." },
  ];
  for (const j of jobs) {
    const jobId = uuid("b1b2c3d4", j.n);
    const { error } = await admin.from("jobs").upsert({
      id: jobId, owner_id: j.owner, title: j.title, description: j.official ? "Sample job showing how work posts look in DevMint." : "",
      category: j.category, deliverables: j.deliver, acceptance_conditions: j.accept, deadline: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      session_minutes: j.session, revisions_allowed: 1, payment_cents: j.pay, status: "open", is_official: j.official,
    });
    if (error) throw new Error(`job ${j.n}: ${error.message}`);
    for (let s = 1; s <= j.slots; s++) {
      await admin.from("job_slots").upsert({ id: uuid("c1b2c3d4", j.n * 10 + s), job_id: jobId, position: s, label: j.slots > 1 ? `Slot ${s}` : null }, { ignoreDuplicates: true });
    }
  }
}

function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

async function seedDemoProject(users: Map<string, string>): Promise<void> {
  const demo = users.get("demo");
  if (!demo) return;
  const projectId = uuid("d1d2d3d4", 1);
  const answers: Answers = {
    idea: "A co-op tower defense on a floating island where players build the base between waves.",
    genres: ["Tower Defense", "Simulator"], audience: ["Teens 13–17", "Cross-platform"],
    core_loop: "Defend waves, earn coins, upgrade towers, expand the island, repeat on harder maps.",
    progression: "Rebirth / prestige", map: "Hub + zones", ui_style: "Chunky cartoon", interaction: "Combat",
    economy: "Soft + premium currency", monetization: ["Gamepasses", "Developer products"], social: ["Co-op", "Leaderboards"],
    dev_time: "1–2 months", team: "2–3 people", budget: "$200–$1,000", community_plan: "Discord first", discord: "Have a basic server",
    social_launch: ["TikTok", "YouTube Shorts"], _skipped: ["comparables", "art", "existing"],
  };
  const summary = buildSummary("idea", answers);

  const { error } = await admin.from("projects").upsert({
    id: projectId, owner_id: demo, title: "Floating Island Defense", route: "idea", stage: "concept", status: "active",
    visibility: "public", progress: 30, ai_provider: "claude", summary: summary as unknown as Json, is_demo: true,
  });
  if (error) throw new Error(`project: ${error.message}`);
  await admin.from("project_members").upsert({ project_id: projectId, user_id: demo, role: "owner" });
  await admin.from("project_interviews").upsert({
    project_id: projectId, answers: answers as Json, current_step: Object.keys(answers).length,
    completed_at: new Date().toISOString(), confirmed_at: new Date().toISOString(),
  });

  const { count: messageCount } = await admin.from("project_messages").select("id", { count: "exact", head: true }).eq("project_id", projectId);
  if (!messageCount) {
    await admin.from("project_messages").insert([
      { project_id: projectId, role: "assistant", content: "Let's pressure-test your idea. I'll ask a handful of questions so the research fits your game." },
      { project_id: projectId, role: "user", content: String(answers.idea) },
      { project_id: projectId, role: "assistant", content: "That's everything I need. Review the summary, edit anything, then confirm to start research." },
    ]);
  }

  const { count: conceptCount } = await admin.from("concepts").select("id", { count: "exact", head: true }).eq("project_id", projectId);
  if (!conceptCount) {
    const today = new Date().toISOString().slice(0, 10);
    const set = fixtureConcepts(answers, today);
    const now = Date.now();
    const jobId = uuid("e1e2e3e4", 1);
    await admin.from("generation_jobs").upsert({
      id: jobId, project_id: projectId, user_id: demo, kind: "concepts", provider: "claude", status: "succeeded",
      credit_category: "research", credits_charged: 10, finished_at: new Date().toISOString(),
    });
    for (const [position, c] of set.concepts.entries()) {
      const score = opportunityScore(c.sub_scores);
      const confidence = confidenceFor(c.sources, now);
      const conceptId = uuid("f1f2f3f4", position + 1);
      const { error: conceptError } = await admin.from("concepts").upsert({
        id: conceptId, project_id: projectId, job_id: jobId, position, title: c.title, hook: c.hook, target_player: c.target_player,
        core_loop: c.core_loop, progression: c.progression, original_angle: c.original_angle,
        comparable_games: c.comparable_games as Json, difficulty: c.difficulty, scope: c.scope,
        monetization: c.monetization as Json, risks: c.risks as Json, opportunity_score: score, score_breakdown: c.sub_scores as Json,
        confidence, score_explanation: explainScore(c.sub_scores, score, confidence, c.score_rationale), is_fixture: true, status: "proposed",
      });
      if (conceptError) throw new Error(`concept: ${conceptError.message}`);
      await admin.from("concept_sources").upsert(
        c.sources.map((s, i) => ({ id: uuid("a9a8a7a6", (position + 1) * 100 + i), concept_id: conceptId, claim: s.claim, url: s.url, title: s.title, publisher: s.publisher, source_date: s.date })),
      );
    }
  }

  const { count: taskCount } = await admin.from("build_tasks").select("id", { count: "exact", head: true }).eq("project_id", projectId);
  if (!taskCount) {
    await admin.from("build_tasks").insert([
      { project_id: projectId, title: "Finish the project interview", position: 0, completed_at: new Date().toISOString() },
      { project_id: projectId, title: "Review your three concepts and approve one", detail: "Open each concept, check the sources, and approve, revise or combine.", position: 1 },
    ]);
  }

  // 30 days of plausible, deterministic metrics so every analytics card renders.
  const rand = lcg(42);
  const rows = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(Date.now() - (29 - i) * 86_400_000).toISOString().slice(0, 10);
    const growth = 1 + i * 0.035;
    const players = Math.round((420 + rand() * 120) * growth);
    return {
      project_id: projectId, captured_on: day, active_players: players,
      retention_d1: Math.round((26 + rand() * 5) * 10) / 10, retention_d7: Math.round((9 + rand() * 2.5) * 10) / 10,
      retention_d30: Math.round((3.2 + rand() * 1.2) * 10) / 10, robux_revenue: Math.round(players * (6 + rand() * 3)),
      visits: Math.round(players * (2.1 + rand() * 0.6)), avg_session_minutes: Math.round((11 + rand() * 4) * 10) / 10,
      conversion_rate: Math.round((2.2 + rand() * 0.8) * 10) / 10, source: "manual" as const, created_by: demo,
    };
  });
  await admin.from("metric_snapshots").upsert(rows, { onConflict: "project_id,captured_on", ignoreDuplicates: true });

  await admin.from("posts").upsert({
    id: uuid("a1b2c3d4", 20), author_id: demo, project_id: projectId, kind: "text",
    body: "Three researched concepts for my tower defense are ready. Voting with my gut: the social spin.",
    created_at: new Date(Date.now() - 3 * 3_600_000).toISOString(),
  });

  await admin.from("subscriptions").update({ plan: "creator" }).eq("user_id", demo);
  const allowances = { research: 100, blueprints: 60, scripts: 100, images: 40, studio: 0 } as const;
  for (const [category, amount] of Object.entries(allowances)) {
    await admin.from("credit_wallets").update({ subscription_balance: amount }).eq("user_id", demo).eq("category", category as keyof typeof allowances);
  }
}

async function main(): Promise<void> {
  const users = await seedUsers();
  await seedPosts(users);
  await seedJobs(users);
  await seedDemoProject(users);
  console.log(`Seed complete. Demo login: ${DEMO_EMAIL} (password from SEED_DEMO_PASSWORD).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
