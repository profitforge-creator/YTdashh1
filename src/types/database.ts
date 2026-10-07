// Hand-maintained mirror of supabase/migrations. Regenerate with `supabase gen types` once a project
// is linked; the Tbl helper keeps Insert types honest about which columns are required.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole = "developer" | "specialist" | "tester" | "player";
export type AiProvider = "claude" | "chatgpt" | "gemini";
export type CreditCategory = "research" | "blueprints" | "scripts" | "images" | "studio";
export type PlanTier = "free" | "creator" | "pro" | "studio";
export type ProjectStage = "interview" | "research" | "concept" | "blueprint" | "assets" | "scripts" | "test";

type Tbl<R, Req extends keyof R = never> = {
  Row: R;
  Insert: Pick<R, Req> & Partial<Omit<R, Req>>;
  Update: Partial<R>;
  Relationships: [];
};

export type ProfileRow = {
  id: string;
  handle: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  roles: AppRole[];
  experience_level: string | null;
  genres: string[];
  skills: string[];
  dm_policy: "open" | "requests";
  is_admin: boolean;
  is_demo: boolean;
  is_official: boolean;
  created_at: string;
  updated_at: string;
}

export type UserPreferencesRow = {
  user_id: string;
  goals: string[];
  weekly_hours: number | null;
  budget_usd: number | null;
  preferred_ai: AiProvider;
  onboarded_at: string | null;
  notification_prefs: Json;
  updated_at: string;
}

export type SubscriptionRow = {
  user_id: string;
  plan: PlanTier;
  status: "active" | "past_due" | "canceled";
  billing_interval: "month" | "year";
  current_period_start: string;
  current_period_end: string;
  last_grant_at: string | null;
  created_at: string;
}

export type CreditWalletRow = {
  user_id: string;
  category: CreditCategory;
  subscription_balance: number;
  purchased_balance: number;
  updated_at: string;
}

export type CreditTransactionRow = {
  id: number;
  user_id: string;
  category: CreditCategory;
  delta: number;
  bucket: "subscription" | "purchased";
  reason: string;
  job_id: string | null;
  created_at: string;
}

export type ProjectRow = {
  id: string;
  owner_id: string;
  title: string;
  route: "discover" | "idea" | "improve";
  stage: ProjectStage;
  status: "active" | "archived";
  visibility: "private" | "public";
  cover_url: string | null;
  progress: number;
  ai_provider: AiProvider;
  summary: Json | null;
  approved_concept_id: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export type ProjectMemberRow = {
  project_id: string;
  user_id: string;
  role: "owner" | "editor" | "viewer";
  created_at: string;
}

export type ProjectInterviewRow = {
  project_id: string;
  answers: Json;
  current_step: number;
  completed_at: string | null;
  confirmed_at: string | null;
  updated_at: string;
}

export type ProjectMessageRow = {
  id: string;
  project_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export type GenerationJobRow = {
  id: string;
  project_id: string;
  user_id: string;
  kind: "concepts" | "chat";
  provider: AiProvider;
  status: "queued" | "running" | "succeeded" | "failed";
  credit_category: CreditCategory;
  credits_charged: number;
  params: Json;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

export type ConceptRow = {
  id: string;
  project_id: string;
  job_id: string | null;
  position: number;
  title: string;
  hook: string;
  target_player: string;
  core_loop: string;
  progression: string;
  original_angle: string;
  comparable_games: Json;
  difficulty: "beginner" | "intermediate" | "advanced";
  scope: string;
  monetization: Json;
  risks: Json;
  opportunity_score: number;
  score_breakdown: Json;
  confidence: "low" | "medium" | "high";
  score_explanation: string;
  status: "proposed" | "approved" | "revision_requested" | "combined" | "superseded";
  revision_note: string | null;
  is_fixture: boolean;
  created_at: string;
}

export type ConceptSourceRow = {
  id: string;
  concept_id: string;
  claim: string;
  url: string;
  title: string;
  publisher: string;
  source_date: string;
}

export type BuildTaskRow = {
  id: string;
  project_id: string;
  title: string;
  detail: string;
  due_at: string | null;
  completed_at: string | null;
  position: number;
  created_at: string;
}

export type BlueprintSectionRow = {
  id: string;
  project_id: string;
  section_key: string;
  title: string;
  content: Json | null;
  status: "pending" | "generating" | "review" | "approved" | "needs_review";
  updated_at: string;
}

export type MetricSnapshotRow = {
  id: string;
  project_id: string;
  captured_on: string;
  active_players: number | null;
  retention_d1: number | null;
  retention_d7: number | null;
  retention_d30: number | null;
  robux_revenue: number | null;
  visits: number | null;
  avg_session_minutes: number | null;
  conversion_rate: number | null;
  source: "manual" | "csv";
  created_by: string;
  created_at: string;
}

export type AnalyticsImportRow = {
  id: string;
  project_id: string;
  user_id: string;
  filename: string;
  rows_imported: number;
  status: "succeeded" | "failed";
  error: string | null;
  created_at: string;
}

export type PostRow = {
  id: string;
  author_id: string;
  body: string;
  kind: "text" | "image" | "video" | "repost";
  project_id: string | null;
  repost_of: string | null;
  is_official: boolean;
  deleted_at: string | null;
  created_at: string;
}

export type MediaRow = {
  id: string;
  post_id: string;
  owner_id: string;
  storage_path: string;
  mime: string;
  kind: "image" | "video";
  created_at: string;
}

export type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  deleted_at: string | null;
  created_at: string;
}

export type ReactionRow = { post_id: string; user_id: string; kind: "like"; created_at: string }
export type FollowRow = { follower_id: string; followee_id: string; created_at: string }
export type BookmarkRow = { user_id: string; post_id: string; created_at: string }
export type BlockRow = { blocker_id: string; blocked_id: string; created_at: string }
export type MuteRow = { muter_id: string; muted_id: string; created_at: string }

export type ReportRow = {
  id: string;
  reporter_id: string;
  target_type: "post" | "comment" | "profile" | "message" | "job";
  target_id: string;
  reason: "spam" | "harassment" | "unsafe" | "scam" | "impersonation" | "other";
  details: string | null;
  status: "open" | "actioned" | "dismissed";
  created_at: string;
}

export type ConversationRow = { id: string; created_at: string; last_message_at: string }
export type ConversationMemberRow = {
  conversation_id: string;
  user_id: string;
  status: "active" | "pending" | "declined";
  last_read_at: string;
}
export type MessageRow = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string }
export type MessageRequestRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
}

export type NotificationRow = {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  immediate: boolean;
  group_key: string | null;
  read_at: string | null;
  created_at: string;
}

export type JobCategory =
  | "tester" | "scripter" | "map_builder" | "ui_designer" | "modeler" | "animator"
  | "thumbnail_artist" | "community_manager" | "discord_setup" | "social_media" | "other";

export type JobRow = {
  id: string;
  owner_id: string;
  project_id: string | null;
  title: string;
  description: string;
  category: JobCategory;
  deliverables: string;
  acceptance_conditions: string;
  deadline: string;
  session_minutes: number | null;
  revisions_allowed: number;
  payment_cents: number;
  status: "open" | "in_progress" | "closed" | "cancelled";
  is_official: boolean;
  created_at: string;
}

export type JobSlotRow = {
  id: string;
  job_id: string;
  position: number;
  label: string | null;
  status: "open" | "filled" | "closed";
  worker_id: string | null;
}

export type ApplicationRow = {
  id: string;
  job_id: string;
  applicant_id: string;
  portfolio_url: string | null;
  proof: string;
  availability: string;
  offer: string;
  status: "pending" | "selected" | "rejected" | "withdrawn";
  created_at: string;
}

export type ContractStatus =
  | "awaiting_funding" | "funded" | "submitted" | "revision_requested"
  | "approved" | "disputed" | "refunded" | "split";

export type ContractRow = {
  id: string;
  job_id: string;
  slot_id: string;
  buyer_id: string;
  worker_id: string;
  amount_cents: number;
  platform_fee_cents: number;
  fee_bps: number;
  status: ContractStatus;
  release_reason: "approved" | "auto_expired" | "dispute_worker" | "dispute_split" | null;
  revisions_allowed: number;
  revisions_used: number;
  deadline: string;
  review_deadline: string | null;
  created_at: string;
  funded_at: string | null;
  submitted_at: string | null;
  resolved_at: string | null;
}

export type EvidenceItem = { path: string; name: string; mime: string }

export type SubmissionRow = {
  id: string;
  contract_id: string;
  worker_id: string;
  note: string;
  evidence: Json;
  revision_no: number;
  created_at: string;
}

export type DisputeRow = {
  id: string;
  contract_id: string;
  opened_by: string;
  reason: string;
  status: "open" | "resolved";
  resolution: "worker" | "buyer" | "split" | null;
  worker_gross_cents: number | null;
  admin_id: string | null;
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
}

export type ReviewRow = {
  id: string;
  contract_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  body: string;
  created_at: string;
}

export type BalanceRow = {
  user_id: string;
  pending_cents: number;
  available_cents: number;
  processing_cents: number;
  paid_out_cents: number;
  refunded_cents: number;
  disputed_cents: number;
  last_hash: string;
  updated_at: string;
}

export type BalanceTransactionRow = {
  id: number;
  user_id: string;
  contract_id: string | null;
  kind: string;
  from_state: string | null;
  to_state: string | null;
  amount_cents: number;
  prev_hash: string;
  hash: string;
  created_at: string;
}

export type RankEventRow = {
  id: number;
  user_id: string;
  component: "game_performance" | "projects" | "paid_work" | "community" | "activity" | "generation";
  kind: string;
  points: number;
  ref_id: string | null;
  dedupe_key: string | null;
  created_at: string;
}

export type RankSnapshotRow = {
  user_id: string;
  score: number;
  tier: string;
  components: Json;
  specialties: string[];
  computed_at: string;
}

export type PerkRow = {
  id: string;
  user_id: string;
  kind: "credits" | "profile_effect" | "badge" | "featured_game" | "early_access";
  label: string;
  meta: Json;
  dedupe_key: string | null;
  granted_at: string;
}

export type PlanAllowanceRow = { plan: PlanTier; category: CreditCategory; monthly_credits: number }

export type Database = {
  public: {
    Tables: {
      profiles: Tbl<ProfileRow, "id" | "handle" | "display_name">;
      user_preferences: Tbl<UserPreferencesRow, "user_id">;
      subscriptions: Tbl<SubscriptionRow, "user_id">;
      credit_wallets: Tbl<CreditWalletRow, "user_id" | "category">;
      credit_transactions: Tbl<CreditTransactionRow, "user_id" | "category" | "delta" | "bucket" | "reason">;
      plan_allowances: Tbl<PlanAllowanceRow, "plan" | "category" | "monthly_credits">;
      projects: Tbl<ProjectRow, "owner_id" | "title" | "route">;
      project_members: Tbl<ProjectMemberRow, "project_id" | "user_id">;
      project_interviews: Tbl<ProjectInterviewRow, "project_id">;
      project_messages: Tbl<ProjectMessageRow, "project_id" | "role" | "content">;
      generation_jobs: Tbl<GenerationJobRow, "project_id" | "user_id" | "kind" | "provider" | "credit_category">;
      concepts: Tbl<
        ConceptRow,
        | "project_id" | "title" | "hook" | "target_player" | "core_loop" | "progression" | "original_angle"
        | "difficulty" | "scope" | "opportunity_score" | "score_breakdown" | "confidence" | "score_explanation"
      >;
      concept_sources: Tbl<ConceptSourceRow, "concept_id" | "claim" | "url" | "title" | "publisher" | "source_date">;
      build_tasks: Tbl<BuildTaskRow, "project_id" | "title">;
      blueprint_sections: Tbl<BlueprintSectionRow, "project_id" | "section_key" | "title">;
      metric_snapshots: Tbl<MetricSnapshotRow, "project_id" | "captured_on" | "source" | "created_by">;
      analytics_imports: Tbl<AnalyticsImportRow, "project_id" | "user_id" | "filename" | "status">;
      posts: Tbl<PostRow, "author_id">;
      media: Tbl<MediaRow, "post_id" | "owner_id" | "storage_path" | "mime" | "kind">;
      comments: Tbl<CommentRow, "post_id" | "author_id" | "body">;
      reactions: Tbl<ReactionRow, "post_id" | "user_id">;
      follows: Tbl<FollowRow, "follower_id" | "followee_id">;
      bookmarks: Tbl<BookmarkRow, "user_id" | "post_id">;
      blocks: Tbl<BlockRow, "blocker_id" | "blocked_id">;
      mutes: Tbl<MuteRow, "muter_id" | "muted_id">;
      reports: Tbl<ReportRow, "reporter_id" | "target_type" | "target_id" | "reason">;
      conversations: Tbl<ConversationRow>;
      conversation_members: Tbl<ConversationMemberRow, "conversation_id" | "user_id">;
      messages: Tbl<MessageRow, "conversation_id" | "sender_id" | "body">;
      message_requests: Tbl<MessageRequestRow, "conversation_id" | "sender_id" | "recipient_id">;
      notifications: Tbl<NotificationRow, "user_id" | "kind" | "title">;
      jobs: Tbl<
        JobRow,
        "owner_id" | "title" | "category" | "deliverables" | "acceptance_conditions" | "deadline" | "payment_cents"
      >;
      job_slots: Tbl<JobSlotRow, "job_id" | "position">;
      applications: Tbl<ApplicationRow, "job_id" | "applicant_id" | "proof" | "availability" | "offer">;
      contracts: Tbl<ContractRow>;
      submissions: Tbl<SubmissionRow>;
      disputes: Tbl<DisputeRow>;
      reviews: Tbl<ReviewRow, "contract_id" | "reviewer_id" | "reviewee_id" | "rating">;
      balances: Tbl<BalanceRow, "user_id">;
      balance_transactions: Tbl<BalanceTransactionRow>;
      rank_events: Tbl<RankEventRow, "user_id" | "component" | "kind" | "points">;
      rank_snapshots: Tbl<RankSnapshotRow, "user_id">;
      perks: Tbl<PerkRow, "user_id" | "kind" | "label">;
    };
    Views: Record<string, never>;
    Functions: {
      approve_concept: { Args: { p_concept: string; p_note?: string | null }; Returns: undefined };
      request_concept_revision: { Args: { p_concept: string; p_note: string }; Returns: undefined };
      grant_monthly_credits: { Args: { p_user: string }; Returns: undefined };
      debit_credits: {
        Args: { p_user: string; p_category: CreditCategory; p_amount: number; p_reason: string; p_job?: string | null };
        Returns: undefined;
      };
      refund_credits: { Args: { p_user: string; p_category: CreditCategory; p_job: string }; Returns: undefined };
      check_rate_limit: { Args: { p_key: string; p_max: number; p_window_seconds: number }; Returns: boolean };
      moderate_report: { Args: { p_report: string; p_action: string; p_note?: string | null }; Returns: undefined };
      start_conversation: { Args: { p_recipient: string; p_body: string }; Returns: string };
      send_message: { Args: { p_conv: string; p_body: string }; Returns: string };
      respond_message_request: { Args: { p_request: string; p_accept: boolean }; Returns: undefined };
      mark_conversation_read: { Args: { p_conv: string }; Returns: undefined };
      notify: {
        Args: {
          p_user: string; p_kind: string; p_title: string; p_body?: string; p_href?: string | null;
          p_immediate?: boolean; p_group?: string | null;
        };
        Returns: undefined;
      };
      select_applicant: { Args: { p_application: string }; Returns: string };
      fund_contract: { Args: { p_contract: string; p_buyer: string; p_provider: string; p_ref: string }; Returns: undefined };
      submit_work: { Args: { p_contract: string; p_note: string; p_evidence: Json }; Returns: undefined };
      request_revision: { Args: { p_contract: string; p_note: string }; Returns: undefined };
      approve_contract: { Args: { p_contract: string }; Returns: undefined };
      release_expired_reviews: { Args: Record<string, never>; Returns: number };
      open_dispute: { Args: { p_contract: string; p_reason: string }; Returns: string };
      resolve_dispute: {
        Args: { p_dispute: string; p_resolution: string; p_worker_gross_cents: number; p_note: string };
        Returns: undefined;
      };
      verify_ledger: { Args: { p_user: string }; Returns: boolean };
      post_stats: {
        Args: { p_ids: string[] };
        Returns: {
          post_id: string; likes: number; comments: number; reposts: number;
          liked: boolean; bookmarked: boolean; reposted: boolean;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
