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
    "talk to someone",
    "real person",
    "human agent",
    "real agent",
    "manager",
    "supervisor",
    "speak to manager",
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

  const complexPhrases = [
    "legal",
    "refund",
    "complaint",
    "lawyer",
    "sue",
    "cancel my account",
    "delete my data",
  ];

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
    conversationStatus === CONVERSATION_STATUS.HUMAN_REQUIRED ||
    conversationStatus === CONVERSATION_STATUS.WITH_HUMAN
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
