import { Redis } from "@upstash/redis";
import { readFileSync } from "fs";
import { parse } from "path";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

interface School {
  id: string;
  name: string;
  tenantId: string;
  domain: string;
  studentFilter: string;
  createdAt: string;
}

interface BatchData {
  emails: string[];
  status: "pending" | "sent" | "failed";
  count: number;
  sentAt?: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function readCsvEmails(path: string, emailCol = "email"): string[] {
  const content = readFileSync(path, "utf-8");
  const lines = content.split("\n");
  const header = lines[0].split(",");
  const emailIdx = header.indexOf(emailCol);
  if (emailIdx === -1) throw new Error(`Column ${emailCol} not found in ${path}`);

  const emails: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const email = cols[emailIdx]?.trim();
    if (email && email.includes("@")) emails.push(email);
  }
  return emails;
}

async function seedSchool(
  school: School,
  csvPath: string,
  batchSize: number = 100
) {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`Seeding: ${school.name}`);

  // Create school
  await redis.set(`school:${school.id}`, school);
  await redis.sadd("schools", school.id);
  console.log(`  School created: ${school.id}`);

  // Read and filter emails
  let emails = readCsvEmails(csvPath);
  emails = emails.filter((e) => e.endsWith(school.studentFilter));
  emails = [...new Set(emails)]; // deduplicate
  emails = shuffle(emails);
  console.log(`  Emails: ${emails.length} (filtered, shuffled)`);

  // Create batches
  const totalBatches = Math.ceil(emails.length / batchSize);
  for (let i = 0; i < totalBatches; i++) {
    const batch = emails.slice(i * batchSize, (i + 1) * batchSize);
    const data: BatchData = {
      emails: batch,
      status: "pending",
      count: batch.length,
    };
    await redis.set(`batch:${school.id}:${i + 1}`, data);
  }
  await redis.set(`batch:${school.id}:total`, totalBatches);
  await redis.set(`batch:${school.id}:contacts`, emails.length);
  console.log(`  Batches: ${totalBatches} × ${batchSize}`);
  console.log(`  Done!`);
}

async function main() {
  console.log("UniHero Seed Script");

  await seedSchool(
    {
      id: "altinbas",
      name: "Altınbaş Üniversitesi",
      tenantId: "d4ef65a2-079c-4516-8bd5-ee6e3b2ce456",
      domain: "ogr.altinbas.edu.tr",
      studentFilter: "@ogr.altinbas.edu.tr",
      createdAt: new Date().toISOString(),
    },
    "ogr_students_2020plus.csv"
  );

  await seedSchool(
    {
      id: "ytu",
      name: "Yıldız Teknik Üniversitesi",
      tenantId: "85602908-e15b-43ba-9148-38bc773a816e",
      domain: "std.yildiz.edu.tr",
      studentFilter: "@std.yildiz.edu.tr",
      createdAt: new Date().toISOString(),
    },
    "ytu_students.csv"
  );

  console.log("\n✅ Seed complete!");
}

main().catch(console.error);
