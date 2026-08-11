export interface WorkspaceEntity {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo: string | null;
  website: string | null;
  status: "active" | "suspended" | "archived";
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
  embedding: string | null;
  metadata: Record<string, unknown>;
  index: number;
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
  conversations: string[];
  leads: string[];
  bookings: string[];
  notes: string | null;
  date_created: string;
  date_updated: string;
}

export interface BookingEntity {
  id: string;
  workspace: string;
  service: string;
  date: string;
  time: string;
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
