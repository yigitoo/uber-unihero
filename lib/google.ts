import {
  getAccessToken,
  setAccessToken,
  getRefreshToken,
  setRefreshToken,
  setAuthEmail,
  getSchool,
  redis,
} from "./redis";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const SCOPES = [
  "https://www.googleapis.com/auth/directory.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

function getRedirectUri() {
  const base = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
  return `${base}/api/auth/google/callback`;
}

// ── OAuth2 Web Flow ──

export function getGoogleAuthUrl(schoolId: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state: schoolId,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCode(code: string, schoolId: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: getRedirectUri(),
    }),
  });

  const data = await res.json();
  if (!data.access_token) return { done: false, error: data.error_description || data.error };

  await setAccessToken(schoolId, data.access_token);
  if (data.refresh_token) await setRefreshToken(schoolId, data.refresh_token);

  const me = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  if (me.ok) {
    const meData = await me.json();
    await setAuthEmail(schoolId, meData.email || "");
  }

  return { done: true };
}

// ── Token Management ──

export async function getValidGoogleToken(schoolId: string): Promise<string | null> {
  let token = await getAccessToken(schoolId);
  if (token) {
    const check = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (check.ok) return token;
  }

  const refresh = await getRefreshToken(schoolId);
  if (!refresh) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();

  if (data.access_token) {
    await setAccessToken(schoolId, data.access_token);
    if (data.refresh_token) await setRefreshToken(schoolId, data.refresh_token);
    return data.access_token;
  }
  return null;
}

// ── Directory Search (PeopleStack Autocomplete — same approach as Outlook) ──

export async function searchGoogleDirectory(
  schoolId: string,
  query: string,
): Promise<{ name: string; email: string; type: string }[]> {
  const cookies = await redis.get<string>(`auth:${schoolId}:google_cookies`);
  const sapisidhash = await redis.get<string>(`auth:${schoolId}:google_sapisidhash`);

  if (!cookies || !sapisidhash) return [];

  // Payload: [134, query, [1,2], 8]
  const payload = JSON.stringify([134, query, [1, 2], 8]);

  const res = await fetch(
    "https://peoplestack-pa.clients6.google.com/$rpc/peoplestack.PeopleStackAutocompleteService/Autocomplete",
    {
      method: "POST",
      headers: {
        "accept": "*/*",
        "authorization": sapisidhash,
        "content-type": "application/json+protobuf",
        "x-goog-api-key": "AIzaSyBm7aDMG9actsWSlx-MvrYsepwdnLgz69I",
        "x-goog-authuser": "0",
        "x-user-agent": "grpc-web-javascript/0.1",
        "cookie": cookies,
        "Referer": "https://mail.google.com/",
      },
      body: payload,
    }
  );

  if (!res.ok) return [];

  try {
    const data = await res.json();
    const results: { name: string; email: string; type: string }[] = [];

    // Parse protobuf-like nested array response
    if (Array.isArray(data) && Array.isArray(data[0])) {
      for (const entry of data[0]) {
        try {
          const person = entry?.[0]?.[0]?.[0];
          if (!person) continue;
          const nameData = person?.[0]?.[1];
          const emailData = person?.[1];
          const name = nameData?.[0] || "";
          const email = emailData?.[0] || "";
          if (email && email.includes("@")) {
            results.push({ name, email, type: "Person" });
          }
        } catch {
          continue;
        }
      }
    }

    return results;
  } catch {
    return [];
  }
}

// ── Send Mail (Gmail API) ──

export async function sendGmail(
  schoolId: string,
  subject: string,
  body: string,
  bccRecipients: string[]
): Promise<{ success: boolean; error?: string }> {
  const token = await getValidGoogleToken(schoolId);
  if (!token) return { success: false, error: "Token yok — authenticate ol" };

  const school = await getSchool(schoolId);
  const authEmail = await redis.get<string>(`auth:${schoolId}:email`);
  const from = authEmail || `noreply@${school?.domain || ""}`;

  const bccHeader = bccRecipients.map(e => `<${e}>`).join(", ");
  const boundary = `boundary_${Date.now()}`;
  const rawMessage = [
    `From: ${from}`,
    `Bcc: ${bccHeader}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    Buffer.from(body).toString("base64"),
    `--${boundary}--`,
  ].join("\r\n");

  const encodedMessage = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: encodedMessage }),
  });

  if (res.ok) return { success: true };
  const text = await res.text();
  return { success: false, error: `${res.status}: ${text.slice(0, 200)}` };
}
