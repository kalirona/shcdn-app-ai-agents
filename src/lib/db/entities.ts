export interface WorkspaceEntity {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo: string | null;
  website: string | null;
  status: "active" | "suspended" | "archived";
  plan: "starter" | "business" | "pro";
  subscription_status: "free" | "trialing" | "active" | "past_due" | "canceled";
  payment_provider: string | null;
  payment_provider_subscription_id: string | null;
  payment_provider_customer_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  date_created: string;
  date_updated: string;
}

export interface MembershipEntity {
  id: string;
  workspace: string;
  user: string;
  role: "owner" | "admin" | "member";
  status: "active" | "invited" | "inactive";
  email: string | null;
  name: string | null;
  date_created: string;
  date_updated: string;
}

export interface AgentEntity {
  id: string;
  workspace: string;
  name: string;
  description: string | null;
  avatar: string | null;
  system_prompt: string;
  tone: "professional" | "friendly" | "casual" | "custom";
  language: string;
  greeting: string;
  fallback_message: string;
  status: "draft" | "active" | "paused";
  date_created: string;
  date_updated: string;
  purpose: string;
  primary_goal: string;
  secondary_goal: string;
  fallback_action: string;
  behaviors: string[];
  allowed_tools: string[];
}

export interface KnowledgeSourceEntity {
  id: string;
  workspace: string;
  agent: string | null;
  type: "website" | "document" | "faq" | "text";
  title: string;
  url: string | null;
  file: string | null;
  status: "pending" | "processing" | "ready" | "failed";
  error_message: string | null;
  chunk_count: number;
  date_created: string;
  date_updated: string;
  visibility: "public" | "internal";
}

export interface KnowledgeChunkEntity {
  id: string;
  source: string;
  content: string;
  /** Vector embedding; Directus returns a JSON array when populated. */
  embedding: number[] | string | null;
  metadata: Record<string, unknown>;
  index: number;
  /** sha256 of the chunk content; used to skip unchanged re-indexes. */
  content_hash: string | null;
  /** Approximate token count for the chunk. */
  token_count: number | null;
}

export interface ConversationEntity {
  id: string;
  workspace: string;
  agent: string;
  customer: string | null;
  customer_email: string | null;
  customer_name: string | null;
  status: "active" | "human_required" | "with_human" | "resolved";
  handoff_trigger: string | null;
  handoff_reason: string | null;
  date_created: string;
  date_updated: string;
}

export interface MessageEntity {
  id: string;
  conversation: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources: Array<{
    title: string;
    url: string | null;
    chunk_id: string | null;
  }> | null;
  metadata: Record<string, unknown>;
  date_created: string;
}

export interface LeadEntity {
  id: string;
  workspace: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  message: string | null;
  source: string | null;
  status: "new" | "contacted" | "qualified" | "won" | "lost";
  qualification: Record<string, string>;
  date_created: string;
  date_updated: string;
}

export interface CustomerEntity {
  id: string;
  workspace: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  stage: "anonymous" | "lead" | "customer";
  conversations?: string[];
  leads?: string[];
  bookings?: string[];
  notes: string | null;
  date_created: string;
  date_updated: string;
}

export interface BookingEntity {
  id: string;
  workspace: string;
  service: string | null;
  date: string | null;
  time: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  notes: string | null;
  status: "confirmed" | "cancelled" | "completed" | "rescheduled";
  date_created: string;
  date_updated: string;
}

export interface ServiceEntity {
  id: string;
  workspace: string;
  name: string;
  description: string | null;
  duration: number;
  price: number | null;
  status: "active" | "inactive";
}

export interface StaffEntity {
  id: string;
  workspace: string;
  name: string;
  email: string;
  role: string;
  working_hours: Record<string, { start: string; end: string }>;
  status: "active" | "inactive";
}

export type WebhookEventName =
  | "conversation.created"
  | "conversation.handoff"
  | "lead.created"
  | "booking.created"
  | "booking.cancelled"
  | "booking.rescheduled";

export interface WebhookEntity {
  id: string;
  workspace: string;
  name: string;
  endpoint_url: string;
  events: WebhookEventName[];
  secret: string | null;
  active: boolean | null;
  date_created: string;
  date_updated: string;
}

export interface WebhookDeliveryEntity {
  id: string;
  webhook: string;
  event: string;
  status: "success" | "failed";
  http_status: number | null;
  response_time: number | null;
  retry_count: number | null;
  date_created: string;
  date_updated: string;
}

/**
 * Idempotency ledger for INBOUND provider webhook events (e.g. PayPal).
 * One row per processed provider event ID so duplicate deliveries are ignored.
 */
export interface WebhookEventEntity {
  id: string;
  event_id: string;
  provider: string;
  event_type: string;
  subscription_id: string | null;
  workspace: string | null;
  status: "processed" | "failed";
  date_created: string;
  date_updated: string;
}

/**
 * Platform-level role assignments (Super Admin).
 * Separate from workspace-level team_memberships.
 */
export interface PlatformRoleEntity {
  id: string;
  user: string;
  role: "super_admin";
  status: "active" | "inactive";
  date_created: string;
  date_updated: string;
}

export type AICapability = "chat" | "vision" | "embeddings" | "image" | "video";

export type AIProviderKey =
  | "openrouter"
  | "gemini"
  | "openai"
  | "anthropic"
  | "glm"
  | "together"
  | "groq"
  | "ollama"
  | "custom";

export type AIProviderType = "openai" | "anthropic" | "gemini" | "ollama" | "openrouter" | "glm" | "together" | "groq" | "custom";

/**
 * Platform-wide settings (singleton collection).
 */
export interface PlatformSettingsEntity {
  id: string;
  platform_name: string | null;
  support_email: string | null;
  maintenance_mode: boolean | null;
  signup_enabled: boolean | null;
  default_workspace_plan: string | null;
  session_timeout_hours: number | null;
  require_2fa: boolean | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_password: string | null;
  from_email: string | null;
  r2_account_id: string | null;
  r2_access_key_id: string | null;
  r2_access_key_secret: string | null;
  r2_bucket: string | null;
  r2_public_url: string | null;
  date_created: string;
  date_updated: string;
}

/**
 * AI provider configuration (platform level).
 */
export interface AIProviderEntity {
  id: string;
  provider_key: AIProviderKey;
  name: string;
  type: AIProviderType;
  api_key: string | null;
  base_url: string | null;
  enabled: boolean;
  priority: number;
  default_model: string | null;
  capabilities: AICapability[];
  status: "untested" | "ok" | "error";
  last_tested_at: string | null;
  last_error: string | null;
  discoverable: boolean;
  date_created: string;
  date_updated: string;
  // Cost tracking (per 1M tokens)
  input_cost_per_million: number | null;
  output_cost_per_million: number | null;
}

/**
 * Model registry entry discovered from a provider.
 */
export interface AIModelEntity {
  id: string;
  provider: string;
  model_id: string;
  name: string;
  capabilities: AICapability[];
  enabled: boolean;
  context_window: number | null;
  // Cost tracking (per 1M tokens)
  input_cost_per_million: number | null;
  output_cost_per_million: number | null;
  source: "discovered" | "manual";
  date_created: string;
  date_updated: string;
}

/**
 * Platform-wide audit trail (singleton-free, one row per event).
 * Written by recordAuditEvent() for auth, admin, workspace, and security events.
 */
export type AuditCategory = "auth" | "admin" | "workspace" | "user" | "security" | "system";

export type AuditSeverity = "info" | "warning" | "critical";

export interface AuditLogEntity {
  id: string;
  /** Directus user ID of the actor; null for system events and failed logins. */
  actor: string | null;
  /** Denormalized actor email for search / display. */
  actor_email: string | null;
  /** Stable action key, e.g. "auth.login", "auth.login_failed", "admin.user.suspend". */
  action: string;
  category: AuditCategory;
  target_type: string | null;
  target_id: string | null;
  /** Human-readable target label (email, workspace name, setting key). */
  target_label: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  status: "success" | "failure";
  severity: AuditSeverity;
  date_created: string;
}

/**
 * Directus user with platform extensions (platform_banned, ban_reason, banned_at, force_password_reset).
 * Returned by Directus /users endpoint.
 */
export interface PlatformUserEntity {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: "active" | "invited" | "suspended" | "archived" | string;
  role: string | null;
  token: string | null;
  last_access: string | null;
  last_page: string | null;
  provider: string;
  external_identifier: string | null;
  /** Platform extension: true when user is banned by platform admin. */
  platform_banned: boolean | null;
  /** Platform extension: ban reason when platform_banned is true. */
  ban_reason: string | null;
  /** Platform extension: when the ban was applied. */
  banned_at: string | null;
  /** Platform extension: when true, user must change password on next login. */
  force_password_reset: boolean | null;
  date_created: string | null;
}

/**
 * Platform AI defaults (singleton collection).
 */
export interface AIDefaultsEntity {
  id: string;
  chat_model: string | null;
  fast_model: string | null;
  vision_model: string | null;
  embedding_model: string | null;
  image_model: string | null;
  video_model: string | null;
  fallback_provider: string | null;
  fallback_model: string | null;
  /** Platform-level system prompt (Super Admin only) - immutable base layer */
  platform_system_prompt: string | null;
  /** Platform safety/security rules (Super Admin only) - immutable base layer */
  platform_safety_rules: string | null;
  /** Fallback system prompt for agents without their own prompt */
  default_system_prompt: string | null;
  date_created: string;
  date_updated: string;
}

/**
 * Provider cost tracking (per request).
 * Tracks input/output tokens and estimated costs per request.
 */
export interface ProviderCostLogEntity {
  id: string;
  provider: string;
  model: string;
  purpose: "chat" | "fast" | "vision" | "embeddings" | "image" | "video";
  input_tokens: number;
  output_tokens: number;
  input_cost: number;
  output_cost: number;
  total_cost: number;
  workspace: string | null;
  agent: string | null;
  user: string | null;
  date_created: string;
  date_updated: string;
}

/**
 * Google Calendar integration per workspace.
 */
export interface CalendarIntegrationEntity {
  id: string;
  workspace: string;
  provider: "google";
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  calendar_id: string | null;
  calendar_name: string | null;
  timezone: string;
  status: "connected" | "disconnected" | "error";
  last_error: string | null;
  google_client_id: string | null;
  google_client_secret_encrypted: string | null;
  date_created: string;
  date_updated: string;
}
