// ── Contact ──

export type ContactCategory = "individual" | "corporate";

export interface Contact {
  _id: string;
  name: string;
  email: string;
  category: ContactCategory;
  company?: string;
  notes?: string;
  tags?: string[];
  createdAt: string;
}

// ── Template ──

export interface Template {
  _id: string;
  name: string;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

// ── Group ──

export interface Group {
  _id: string;
  name: string;
  description?: string;
  color?: string;
  members: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GroupSummary extends Omit<Group, "members"> {
  memberCount: number;
}

// ── School ──

export type SchoolProvider = "outlook" | "google";

export interface School {
  id: string;
  name: string;
  tenantId: string;
  domain: string;
  studentFilter: string;
  provider?: SchoolProvider;
  createdAt: string;
}

// ── Batch ──

export type BatchStatus = "pending" | "sent" | "failed";
export type BatchSource = "scrape" | "csv" | "manual" | "group";

export interface BatchData {
  emails: string[];
  status: BatchStatus;
  sentAt?: string;
  count: number;
  error?: string;
  source?: BatchSource;
}

// ── Send Log ──

export type SendLogStatus = "sent" | "failed";

export interface SendLog {
  batchId: number;
  count: number;
  status: SendLogStatus;
  timestamp: string;
  error?: string;
  duration?: number;
}

// ── Settings ──

export interface GlobalSettings {
  defaultBatchSize: number;
  defaultDailyLimit: number;
  defaultDelay: number;
  defaultMaxBatchesPerRun: number;
}

export interface SchoolSettings {
  batchSize: number;
  dailyLimit: number;
  delayBetweenBatches: number;
  autoSend: boolean;
  autoSendTime: string;
  maxBatchesPerRun: number;
}

// ── Auth ──

export interface User {
  _id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  createdAt: string;
}

// ── Filter ──

export type ContactFilter = "all" | ContactCategory;
