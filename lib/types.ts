// ─── Lead Generation & Sales CRM Types ───

export type LeadStatus = "new" | "contacted" | "qualified" | "unqualified" | "nurturing";
export type LeadSource = "linkedin" | "cold_email" | "referral" | "website" | "social_media" | "paid_ads" | "n8n_flow" | "manual";
export type DealStage = "new" | "qualified" | "proposal" | "negotiation" | "closed_won" | "closed_lost";
export type Priority = "low" | "medium" | "high" | "urgent";
export type ActivityType = "call" | "email" | "meeting" | "note" | "task" | "deal_moved" | "lead_created" | "workflow_triggered";
export type N8NWorkflowStatus = "active" | "inactive" | "error";

export interface Lead {
  id: string;
  name: string;
  email: string;
  company: string;
  role: string;
  phone?: string;
  status: LeadStatus;
  source: LeadSource;
  score: number; // 0-100
  priority: Priority;
  tags: string[];
  notes?: string;
  assignedTo?: string;
  createdAt: string;
  lastContactedAt?: string;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  company: string;
  role: string;
  phone?: string;
  avatar?: string;
  tags: string[];
  linkedLeadIds: string[];
  createdAt: string;
  lastInteractionAt?: string;
}

export interface Deal {
  id: string;
  title: string;
  value: number;
  currency: string;
  stage: DealStage;
  probability: number;
  contactId: string;
  contactName: string;
  company: string;
  daysInStage: number;
  expectedCloseDate: string;
  notes?: string;
  createdAt: string;
}

export interface PipelineStage {
  id: DealStage;
  label: string;
  color: string;
  deals: Deal[];
}

export interface N8NWorkflow {
  id: string;
  name: string;
  description: string;
  status: N8NWorkflowStatus;
  webhookUrl?: string;
  lastExecutedAt?: string;
  executionCount: number;
  errorCount: number;
  tags: string[];
  createdAt: string;
}

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  entityId?: string;
  entityType?: "lead" | "contact" | "deal" | "workflow";
  entityName?: string;
  createdAt: string;
}

export interface DashboardStats {
  totalLeads: number;
  newLeadsThisWeek: number;
  conversionRate: number;
  conversionRateChange: number;
  revenuePipeline: number;
  revenuePipelineChange: number;
  activeWorkflows: number;
  dealsClosedThisMonth: number;
}

// ─── Lead Engine Types ───

export type EmailVerificationStatus = "valid" | "invalid" | "catch_all" | "unknown" | "unverified" | "error";

export interface ScrapedLead {
  name: string;
  title: string;
  company: string;
  linkedinUrl: string;
  snippet: string;
  email?: string;
  emailStatus?: EmailVerificationStatus;
  addedToCrm?: boolean;
}

export interface EmailResult {
  email: string;
  pattern: string;
  priority: number;
  status: EmailVerificationStatus;
  message: string;
}

export interface SearchQuery {
  jobTitle: string;
  location?: string;
  industry?: string;
  keywords?: string;
}
