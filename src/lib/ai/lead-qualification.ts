export interface QualificationQuestion {
  id: string;
  question: string;
  type: "text" | "select" | "number" | "boolean";
  options?: string[];
  required: boolean;
  askAutomatically: boolean;
  order: number;
}

export interface LeadQualificationConfig {
  questions: QualificationQuestion[];
  enabled: boolean;
}

export const DEFAULT_QUALIFICATION_QUESTIONS: QualificationQuestion[] = [
  {
    id: "service_interest",
    question: "What service are you interested in?",
    type: "select",
    options: ["Web Design", "SEO", "Marketing", "Consulting", "Other"],
    required: true,
    askAutomatically: true,
    order: 1,
  },
  {
    id: "budget",
    question: "What is your approximate budget?",
    type: "select",
    options: ["Under $1,000", "$1,000 - $5,000", "$5,000 - $10,000", "$10,000+", "Not sure yet"],
    required: false,
    askAutomatically: true,
    order: 2,
  },
  {
    id: "timeline",
    question: "When do you need this completed?",
    type: "select",
    options: ["ASAP", "Within 1 month", "Within 3 months", "No rush"],
    required: false,
    askAutomatically: true,
    order: 3,
  },
  {
    id: "company_size",
    question: "How many people are in your company?",
    type: "select",
    options: ["Just me", "2-10", "11-50", "51-200", "200+"],
    required: false,
    askAutomatically: false,
    order: 4,
  },
  {
    id: "requirements",
    question: "Can you describe your requirements?",
    type: "text",
    required: false,
    askAutomatically: false,
    order: 5,
  },
];

export interface LeadData {
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  source: string;
  qualification: Record<string, string>;
  stage: "new" | "contacted" | "qualified" | "won" | "lost";
}

export function createEmptyLead(workspaceId: string, source: string): LeadData {
  return {
    name: "",
    email: "",
    phone: null,
    company: null,
    source,
    qualification: {},
    stage: "new",
  };
}

export function isLeadQualified(lead: LeadData): boolean {
  return lead.name.trim().length > 0 && lead.email.trim().length > 0;
}

export function getQuestionsForAgent(
  config: LeadQualificationConfig | null,
): QualificationQuestion[] {
  if (!config || !config.enabled) return [];
  return config.questions
    .filter((q) => q.askAutomatically)
    .sort((a, b) => a.order - b.order);
}

export function shouldAskQuestion(
  question: QualificationQuestion,
  leadData: LeadData,
): boolean {
  if (!question.askAutomatically) return false;
  if (leadData.qualification[question.id]) return false;
  return true;
}
