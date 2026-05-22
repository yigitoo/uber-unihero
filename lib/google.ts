import {
  getAccessToken,
  setAccessToken,
  getRefreshToken,
  setRefreshToken,
  setAuthEmail,
  setDeviceCode,
  getDeviceCode,
  getSchool,
} from "./redis";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const SCOPES = [
  "https://www.googleapis.com/auth/directory.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

// ── Device Code Flow ──

export async function startGoogleDeviceCode(schoolId: string) {
  const res = await fetch("https://oauth2.googleapis.com/device/code", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      scope: SCOPES,
    }),
  });
  const data = await res.json();
  await setDeviceCode(schoolId, data.device_code);

  return {
    userCode: data.user_code as string,
    verificationUri: data.verification_url as string,
  };
}

export async function pollGoogleDeviceCode(schoolId: string) {
  const deviceCode = await getDeviceCode(schoolId);
  if (!deviceCode) return { done: false, error: "No device code" };

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      device_code: deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    }),
  });
  const data = await res.json();

  if (data.error === "authorization_pending") return { done: false };
  if (data.error === "slow_down") return { done: false };
  if (data.error) return { done: false, error: data.error_description || data.error };

  if (data.access_token) {
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

  return { done: false, error: "Unexpected response" };
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

// ── Directory Search (People API) ──

export async function searchGoogleDirectory(
  schoolId: string,
  query: string,
  pageSize = 100
): Promise<{ name: string; email: string; type: string }[]> {
  const token = await getValidGoogleToken(schoolId);
  if (!token) return [];

  const params = new URLSearchParams({
    query,
    readMask: "names,emailAddresses",
    sources: "DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE",
    pageSize: String(pageSize),
  });

  const res = await fetch(
    `https://people.googleapis.com/v1/people:searchDirectoryPeople?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) return [];
  const data = await res.json();

  const results: { name: string; email: string; type: string }[] = [];
  for (const person of data.people || []) {
    const email = person.emailAddresses?.[0]?.value;
    const name = person.names?.[0]?.displayName || "";
    if (email) {
      results.push({ name, email, type: "Person" });
    }
  }
  return results;
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
  const from = school ? `noreply@${school.domain}` : "";

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
