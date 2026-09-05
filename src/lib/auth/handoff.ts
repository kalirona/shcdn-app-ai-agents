export const CONVERSATION_STATUS = {
  ACTIVE: "active",
  HUMAN_REQUIRED: "human_required",
  WITH_HUMAN: "with_human",
  RESOLVED: "resolved",
} as const;

export type ConversationStatus = (typeof CONVERSATION_STATUS)[keyof typeof CONVERSATION_STATUS];

export const CUSTOMER_STAGE = {
  ANONYMOUS: "anonymous",
  LEAD: "lead",
  CUSTOMER: "customer",
} as const;

export type CustomerStage = (typeof CUSTOMER_STAGE)[keyof typeof CUSTOMER_STAGE];

export const HANDOFF_TRIGGERS = {
  EXPLICIT_REQUEST: "explicit_request",
  FRUSTRATION_DETECTED: "frustration_detected",
  COMPLEX_ISSUE: "complex_issue",
  AI_UNABLE: "ai_unable",
} as const;

export type HandoffTrigger = (typeof HANDOFF_TRIGGERS)[keyof typeof HANDOFF_TRIGGERS];

export interface HandoffState {
  isHandoffRequired: boolean;
  trigger?: HandoffTrigger;
  reason?: string;
  timestamp?: string;
}

export interface CustomerIdentity {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  stage: CustomerStage;
  workspace: string;
  conversations: string[];
  leads: string[];
  bookings: string[];
  notes: string;
  dateCreated: string;
  dateUpdated: string;
}

export function detectHandoffNeed(message: string): HandoffState {
  const lowerMessage = message.toLowerCase();

  const explicitPhrases = [
    "speak to a human",
    "talk to a human",
    "talk to someone",
    "talk to a person",
    "speak to a person",
    "speak with a person",
    "speak with someone",
    "real person",
    "human agent",
    "real agent",
    "human support",
    "support agent",
    "customer support",
    "customer service agent",
    "representative",
    "manager",
    "supervisor",
    "speak to manager",
    "talk to a manager",
    "want to talk to a human",
    "need to talk to a human",
    "i want to talk to a human",
    "i want a human",
    "i need a human",
    "connect me to a human",
    "connect me with a human",
    "connect me to someone",
    "connect me with someone",
    "connect me to a person",
    "transfer me to a human",
    "transfer to human",
    "transfer to a human",
    "transfer me to a person",
    "get a human",
    "get a real person",
    "talk to an agent",
    "someone from your team",
    "team member",
    "someone real",
    "escalate",
    "i'd like to talk",
    "i want to talk to someone",
    "can i talk to",
  ];

  const frustrationPhrases = [
    "this is ridiculous",
    "useless",
    "stupid",
    "waste of time",
    "not helping",
    "doesn't work",
    "doesn't make sense",
  ];

  const complexPhrases = ["legal", "refund", "complaint", "lawyer", "sue", "cancel my account", "delete my data"];

  for (const phrase of explicitPhrases) {
    if (lowerMessage.includes(phrase)) {
      return {
        isHandoffRequired: true,
        trigger: HANDOFF_TRIGGERS.EXPLICIT_REQUEST,
        reason: "Customer explicitly requested a human",
        timestamp: new Date().toISOString(),
      };
    }
  }

  for (const phrase of frustrationPhrases) {
    if (lowerMessage.includes(phrase)) {
      return {
        isHandoffRequired: true,
        trigger: HANDOFF_TRIGGERS.FRUSTRATION_DETECTED,
        reason: "Customer showing signs of frustration",
        timestamp: new Date().toISOString(),
      };
    }
  }

  for (const phrase of complexPhrases) {
    if (lowerMessage.includes(phrase)) {
      return {
        isHandoffRequired: true,
        trigger: HANDOFF_TRIGGERS.COMPLEX_ISSUE,
        reason: "Complex issue requiring human intervention",
        timestamp: new Date().toISOString(),
      };
    }
  }

  return { isHandoffRequired: false };
}

export function shouldAIRespond(conversationStatus: ConversationStatus): boolean {
  return conversationStatus === CONVERSATION_STATUS.ACTIVE;
}

export function shouldNotifyBusiness(conversationStatus: ConversationStatus): boolean {
  return (
    conversationStatus === CONVERSATION_STATUS.HUMAN_REQUIRED || conversationStatus === CONVERSATION_STATUS.WITH_HUMAN
  );
}

export function getConversationStatusLabel(status: ConversationStatus): string {
  const labels: Record<ConversationStatus, string> = {
    [CONVERSATION_STATUS.ACTIVE]: "AI Handling",
    [CONVERSATION_STATUS.HUMAN_REQUIRED]: "Needs Human",
    [CONVERSATION_STATUS.WITH_HUMAN]: "Human Responding",
    [CONVERSATION_STATUS.RESOLVED]: "Resolved",
  };
  return labels[status];
}

export function canResumeAI(status: ConversationStatus): boolean {
  return status === CONVERSATION_STATUS.RESOLVED;
}

export function promoteToCustomer(identity: CustomerIdentity): CustomerIdentity {
  return {
    ...identity,
    stage: CUSTOMER_STAGE.CUSTOMER,
    dateUpdated: new Date().toISOString(),
  };
}
