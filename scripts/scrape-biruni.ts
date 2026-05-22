import crypto from "crypto";
import fs from "fs";

const COOKIES = process.env.BIRUNI_COOKIES!;
const SAPISID = COOKIES.match(/SAPISID=([^;]+)/)?.[1] || "";
const ORIGIN = "https://mail.google.com";
const LETTERS = "abcçdefgğhıijklmnoöprsştuüvwxyz".split("");
const OUTPUT_FILE = "biruni_directory.json";

function generateSapisidHash(): string {
  const ts = Math.floor(Date.now() / 1000);
  const hash = crypto.createHash("sha1").update(`${ts} ${SAPISID} ${ORIGIN}`).digest("hex");
  return `SAPISIDHASH ${ts}_${hash}`;
}

async function search(query: string): Promise<{ name: string; email: string }[]> {
  const res = await fetch(
    "https://peoplestack-pa.clients6.google.com/$rpc/peoplestack.PeopleStackAutocompleteService/Autocomplete",
    {
      method: "POST",
      headers: {
        accept: "*/*",
        origin: ORIGIN,
        authorization: generateSapisidHash(),
        "content-type": "application/json+protobuf",
        "x-goog-api-key": "AIzaSyBm7aDMG9actsWSlx-MvrYsepwdnLgz69I",
        "x-goog-authuser": "0",
        "x-user-agent": "grpc-web-javascript/0.1",
        cookie: COOKIES,
        Referer: "https://mail.google.com/",
      },
      body: JSON.stringify([134, query, [1, 2], 8]),
    }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const results: { name: string; email: string }[] = [];
  if (Array.isArray(data) && Array.isArray(data[0])) {
    for (const entry of data[0]) {
      try {
        const person = entry?.[0]?.[0]?.[0];
        const name = person?.[0]?.[1]?.[0] || "";
        const email = person?.[1]?.[0] || "";
        if (email && email.includes("@")) results.push({ name, email });
      } catch {}
    }
  }
  return results;
}

async function main() {
  const allEmails = new Map<string, string>();

  // Phase 1
  const drillLetters: string[] = [];
  for (let i = 0; i < LETTERS.length; i++) {
    const results = await search(LETTERS[i]);
    for (const r of results) if (!allEmails.has(r.email)) allEmails.set(r.email, r.name);
    if (results.length >= 8) drillLetters.push(LETTERS[i]);
    process.stdout.write(`\rP1: ${i + 1}/${LETTERS.length} | ${allEmails.size} found`);
    await new Promise(r => setTimeout(r, 200));
  }
  console.log();

  // Phase 2
  const queries2: string[] = [];
  for (const p of drillLetters) for (const l of LETTERS) queries2.push(p + l);
  const drillLetters2: string[] = [];
  for (let i = 0; i < queries2.length; i++) {
    const results = await search(queries2[i]);
    for (const r of results) if (!allEmails.has(r.email)) allEmails.set(r.email, r.name);
    if (results.length >= 8) drillLetters2.push(queries2[i]);
    if ((i + 1) % 10 === 0) process.stdout.write(`\rP2: ${i + 1}/${queries2.length} | ${allEmails.size} found`);
    await new Promise(r => setTimeout(r, 150));
  }
  console.log();

  // Phase 3
  const queries3: string[] = [];
  for (const p of drillLetters2) for (const l of LETTERS) queries3.push(p + l);
  for (let i = 0; i < queries3.length; i++) {
    const results = await search(queries3[i]);
    for (const r of results) if (!allEmails.has(r.email)) allEmails.set(r.email, r.name);
    if ((i + 1) % 20 === 0) process.stdout.write(`\rP3: ${i + 1}/${queries3.length} | ${allEmails.size} found`);
    await new Promise(r => setTimeout(r, 100));
  }
  console.log();

  // Save to file
  const data = Array.from(allEmails.entries()).map(([email, name]) => ({ name, email }));
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));
  console.log(`\nDone! ${data.length} emails → ${OUTPUT_FILE}`);
}

main().catch(console.error);
