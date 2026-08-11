export const AGENT_BEHAVIORS = {
  ANSWER_QUESTIONS: "answer_questions",
  CAPTURE_LEADS: "capture_leads",
  BOOK_APPOINTMENTS: "book_appointments",
  CREATE_QUOTES: "create_quotes",
  HUMAN_HANDOFF: "human_handoff",
  COLLECT_CUSTOMER_INFO: "collect_customer_info",
  ASK_QUALIFYING_QUESTIONS: "ask_qualifying_questions",
  SEND_EMAILS: "send_emails",
} as const;

export type AgentBehavior = (typeof AGENT_BEHAVIORS)[keyof typeof AGENT_BEHAVIORS];

export const AGENT_BEHAVIOR_LABELS: Record<AgentBehavior, string> = {
  [AGENT_BEHAVIORS.ANSWER_QUESTIONS]: "Answer questions",
  [AGENT_BEHAVIORS.CAPTURE_LEADS]: "Capture leads",
  [AGENT_BEHAVIORS.BOOK_APPOINTMENTS]: "Book appointments",
  [AGENT_BEHAVIORS.CREATE_QUOTES]: "Create quotes",
  [AGENT_BEHAVIORS.HUMAN_HANDOFF]: "Transfer to human",
  [AGENT_BEHAVIORS.COLLECT_CUSTOMER_INFO]: "Collect customer information",
  [AGENT_BEHAVIORS.ASK_QUALIFYING_QUESTIONS]: "Ask qualifying questions",
  [AGENT_BEHAVIORS.SEND_EMAILS]: "Send emails",
};

export const AGENT_BEHAVIOR_DESCRIPTIONS: Record<AgentBehavior, string> = {
  [AGENT_BEHAVIORS.ANSWER_QUESTIONS]: "Answer customer questions from knowledge base",
  [AGENT_BEHAVIORS.CAPTURE_LEADS]: "Capture contact information from prospects",
  [AGENT_BEHAVIORS.BOOK_APPOINTMENTS]: "Schedule and manage appointments",
  [AGENT_BEHAVIORS.CREATE_QUOTES]: "Generate price quotes for customers",
  [AGENT_BEHAVIORS.HUMAN_HANDOFF]: "Transfer conversation to a human agent",
  [AGENT_BEHAVIORS.COLLECT_CUSTOMER_INFO]: "Gather names, emails, and phone numbers",
  [AGENT_BEHAVIORS.ASK_QUALIFYING_QUESTIONS]: "Ask BANT-style qualifying questions",
  [AGENT_BEHAVIORS.SEND_EMAILS]: "Send emails to customers",
};

export const TOOLS = {
  CAPTURE_LEAD: "capture_lead",
  CREATE_CUSTOMER: "create_customer",
  GET_CUSTOMER: "get_customer",
  CHECK_AVAILABILITY: "check_availability",
  CREATE_BOOKING: "create_booking",
  CANCEL_BOOKING: "cancel_booking",
  RESCHEDULE_BOOKING: "reschedule_booking",
  REQUEST_HUMAN: "request_human",
  SEND_CONTACT_REQUEST: "send_contact_request",
  CREATE_QUOTE: "create_quote",
  SEND_EMAIL: "send_email",
} as const;

export type Tool = (typeof TOOLS)[keyof typeof TOOLS];

export const TOOL_LABELS: Record<Tool, string> = {
  [TOOLS.CAPTURE_LEAD]: "Capture Lead",
  [TOOLS.CREATE_CUSTOMER]: "Create Customer",
  [TOOLS.GET_CUSTOMER]: "Look Up Customer",
  [TOOLS.CHECK_AVAILABILITY]: "Check Availability",
  [TOOLS.CREATE_BOOKING]: "Create Booking",
  [TOOLS.CANCEL_BOOKING]: "Cancel Booking",
  [TOOLS.RESCHEDULE_BOOKING]: "Reschedule Booking",
  [TOOLS.REQUEST_HUMAN]: "Request Human",
  [TOOLS.SEND_CONTACT_REQUEST]: "Send Contact Request",
  [TOOLS.CREATE_QUOTE]: "Create Quote",
  [TOOLS.SEND_EMAIL]: "Send Email",
};

export const TOOL_CATEGORIES: Record<string, Tool[]> = {
  communication: [TOOLS.REQUEST_HUMAN, TOOLS.SEND_CONTACT_REQUEST, TOOLS.SEND_EMAIL],
  leads: [TOOLS.CAPTURE_LEAD, TOOLS.CREATE_CUSTOMER, TOOLS.GET_CUSTOMER],
  booking: [TOOLS.CHECK_AVAILABILITY, TOOLS.CREATE_BOOKING, TOOLS.CANCEL_BOOKING, TOOLS.RESCHEDULE_BOOKING],
  sales: [TOOLS.CREATE_QUOTE],
};

export const BEHAVIOR_TOOLS: Record<AgentBehavior, Tool[]> = {
  [AGENT_BEHAVIORS.ANSWER_QUESTIONS]: [],
  [AGENT_BEHAVIORS.CAPTURE_LEADS]: [TOOLS.CAPTURE_LEAD, TOOLS.CREATE_CUSTOMER],
  [AGENT_BEHAVIORS.BOOK_APPOINTMENTS]: [
    TOOLS.CHECK_AVAILABILITY,
    TOOLS.CREATE_BOOKING,
    TOOLS.CANCEL_BOOKING,
    TOOLS.RESCHEDULE_BOOKING,
  ],
  [AGENT_BEHAVIORS.CREATE_QUOTES]: [TOOLS.CREATE_QUOTE],
  [AGENT_BEHAVIORS.HUMAN_HANDOFF]: [TOOLS.REQUEST_HUMAN],
  [AGENT_BEHAVIORS.COLLECT_CUSTOMER_INFO]: [TOOLS.CREATE_CUSTOMER, TOOLS.GET_CUSTOMER],
  [AGENT_BEHAVIORS.ASK_QUALIFYING_QUESTIONS]: [],
  [AGENT_BEHAVIORS.SEND_EMAILS]: [TOOLS.SEND_EMAIL],
};

export function getToolsForBehaviors(behaviors: AgentBehavior[]): Tool[] {
  const tools = new Set<Tool>();
  for (const behavior of behaviors) {
    const behaviorTools = BEHAVIOR_TOOLS[behavior] || [];
    behaviorTools.forEach((tool) => tools.add(tool));
  }
  return Array.from(tools);
}

export const KNOWLEDGE_VISIBILITY = {
  PUBLIC: "public",
  INTERNAL: "internal",
} as const;

export type KnowledgeVisibility = (typeof KNOWLEDGE_VISIBILITY)[keyof typeof KNOWLEDGE_VISIBILITY];
