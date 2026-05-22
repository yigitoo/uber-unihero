import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// ── School ──

export interface School {
  id: string;
  name: string;
  tenantId: string;
  domain: string;
  studentFilter: string;
  provider?: "outlook" | "google";
  createdAt: string;
}

export async function getSchools(): Promise<School[]> {
  const ids = await redis.smembers("schools");
  if (!ids.length) return [];
  const pipeline = redis.pipeline();
  for (const id of ids) pipeline.get(`school:${id}`);
  const results = await pipeline.exec<(School | null)[]>();
  return results.filter(Boolean) as School[];
}

export async function getSchool(id: string): Promise<School | null> {
  return redis.get<School>(`school:${id}`);
}

export async function createSchool(school: School): Promise<void> {
  await redis.set(`school:${school.id}`, school);
  await redis.sadd("schools", school.id);
}

export async function deleteSchool(id: string): Promise<void> {
  await redis.del(`school:${id}`);
  await redis.srem("schools", id);
}

// ── Auth ──

export async function getRefreshToken(schoolId: string): Promise<string | null> {
  return redis.get<string>(`auth:${schoolId}:refresh`);
}

export async function setRefreshToken(schoolId: string, token: string): Promise<void> {
  await redis.set(`auth:${schoolId}:refresh`, token);
}

export async function getAccessToken(schoolId: string): Promise<string | null> {
  return redis.get<string>(`auth:${schoolId}:access`);
}

export async function setAccessToken(schoolId: string, token: string): Promise<void> {
  await redis.set(`auth:${schoolId}:access`, token, { ex: 3500 });
}

export async function setAuthEmail(schoolId: string, email: string): Promise<void> {
  await redis.set(`auth:${schoolId}:email`, email);
}

export async function getAuthEmail(schoolId: string): Promise<string | null> {
  return redis.get<string>(`auth:${schoolId}:email`);
}

// ── Batches ──

export interface BatchData {
  emails: string[];
  status: "pending" | "sent" | "failed";
  sentAt?: string;
  count: number;
  error?: string;
}

export async function setBatch(schoolId: string, n: number, data: BatchData): Promise<void> {
  await redis.set(`batch:${schoolId}:${n}`, data);
}

export async function getBatch(schoolId: string, n: number): Promise<BatchData | null> {
  return redis.get<BatchData>(`batch:${schoolId}:${n}`);
}

export async function getTotalBatches(schoolId: string): Promise<number> {
  return (await redis.get<number>(`batch:${schoolId}:total`)) ?? 0;
}

export async function setTotalBatches(schoolId: string, total: number): Promise<void> {
  await redis.set(`batch:${schoolId}:total`, total);
}

export async function getContactCount(schoolId: string): Promise<number> {
  return (await redis.get<number>(`batch:${schoolId}:contacts`)) ?? 0;
}

export async function setContactCount(schoolId: string, count: number): Promise<void> {
  await redis.set(`batch:${schoolId}:contacts`, count);
}

export async function getAllBatches(schoolId: string): Promise<BatchData[]> {
  const total = await getTotalBatches(schoolId);
  if (!total) return [];
  const pipeline = redis.pipeline();
  for (let i = 1; i <= total; i++) pipeline.get(`batch:${schoolId}:${i}`);
  const results = await pipeline.exec<(BatchData | null)[]>();
  return results.map((r, i) => r ?? { emails: [], status: "pending" as const, count: 0 });
}

// ── Mail Template ──

export async function getMailTemplate(schoolId: string): Promise<{ subject: string; body: string } | null> {
  const [subject, body] = await Promise.all([
    redis.get<string>(`mail:${schoolId}:subject`),
    redis.get<string>(`mail:${schoolId}:body`),
  ]);
  if (!subject || !body) return null;
  return { subject, body };
}

export async function setMailTemplate(schoolId: string, subject: string, body: string): Promise<void> {
  await Promise.all([
    redis.set(`mail:${schoolId}:subject`, subject),
    redis.set(`mail:${schoolId}:body`, body),
  ]);
}

// ── Daily Counter ──

export async function getTodaySent(schoolId: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  return (await redis.get<number>(`sent:${schoolId}:${today}`)) ?? 0;
}

export async function incrementTodaySent(schoolId: string, count: number): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await redis.incrby(`sent:${schoolId}:${today}`, count);
}

// ── Scrape State ──

export interface ScrapeState {
  status: "idle" | "running" | "done";
  found: number;
  skippedGroups: number;
  phase: number;
  queries: string[];
  currentIndex: number;
  drillLetters: string[];
  allEmails: string[];
}

export async function getScrapeState(schoolId: string): Promise<ScrapeState | null> {
  return redis.get<ScrapeState>(`scrape:${schoolId}`);
}

export async function setScrapeState(schoolId: string, state: ScrapeState): Promise<void> {
  await redis.set(`scrape:${schoolId}`, state);
}

// ── Device Code (temp) ──

export async function setDeviceCode(schoolId: string, code: string): Promise<void> {
  await redis.set(`device:${schoolId}`, code, { ex: 900 });
}

export async function getDeviceCode(schoolId: string): Promise<string | null> {
  return redis.get<string>(`device:${schoolId}`);
}
