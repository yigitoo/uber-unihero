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

const CLIENT_ID = "d3590ed6-52b3-4102-aeff-aad2292ab01c";
const SCOPE = "https://outlook.office.com/.default offline_access";

function tokenUrl(tenantId: string) {
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
}

// ── Device Code Flow ──

export async function startDeviceCode(schoolId: string) {
  const school = await getSchool(schoolId);
  if (!school) throw new Error("School not found");

  const res = await fetch(
    `https://login.microsoftonline.com/${school.tenantId}/oauth2/v2.0/devicecode`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: CLIENT_ID, scope: SCOPE }),
    }
  );
  const data = await res.json();
  await setDeviceCode(schoolId, data.device_code);

  return {
    userCode: data.user_code as string,
    verificationUri: data.verification_uri as string,
  };
}

export async function pollDeviceCode(schoolId: string) {
  const school = await getSchool(schoolId);
  const deviceCode = await getDeviceCode(schoolId);
  if (!school || !deviceCode) return { done: false, error: "No device code" };

  const res = await fetch(tokenUrl(school.tenantId), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      client_id: CLIENT_ID,
      device_code: deviceCode,
    }),
  });
  const data = await res.json();

  if (data.error === "authorization_pending") return { done: false };
  if (data.error) return { done: false, error: data.error_description || data.error };

  if (data.access_token) {
    await setAccessToken(schoolId, data.access_token);
    if (data.refresh_token) await setRefreshToken(schoolId, data.refresh_token);

    const me = await fetch("https://outlook.office.com/api/v2.0/me", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (me.ok) {
      const meData = await me.json();
      await setAuthEmail(schoolId, meData.EmailAddress || "");
    }
    return { done: true };
  }

  return { done: false, error: "Unexpected response" };
}

// ── Token Management ──

export async function getValidToken(schoolId: string): Promise<string | null> {
  let token = await getAccessToken(schoolId);
  if (token) {
    const check = await fetch("https://outlook.office.com/api/v2.0/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (check.ok) return token;
  }

  const school = await getSchool(schoolId);
  const refresh = await getRefreshToken(schoolId);
  if (!school || !refresh) return null;

  const res = await fetch(tokenUrl(school.tenantId), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      refresh_token: refresh,
      scope: SCOPE,
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

// ── Send Mail ──

export async function sendMail(
  schoolId: string,
  subject: string,
  body: string,
  bccRecipients: string[]
): Promise<{ success: boolean; error?: string }> {
  const token = await getValidToken(schoolId);
  if (!token) return { success: false, error: "Token yok — authenticate ol" };

  const payload = {
    Message: {
      Subject: subject,
      Body: { ContentType: "HTML", Content: body },
      BccRecipients: bccRecipients.map((email) => ({
        EmailAddress: { Address: email },
      })),
    },
  };

  const res = await fetch("https://outlook.office.com/api/v2.0/me/sendmail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 202 || res.status === 200) return { success: true };
  const text = await res.text();
  return { success: false, error: `${res.status}: ${text.slice(0, 200)}` };
}

// ── Directory Search ──

export async function searchPeople(
  schoolId: string,
  query: string,
  size = 100
): Promise<{ name: string; email: string; type: string }[]> {
  const token = await getValidToken(schoolId);
  if (!token) return [];

  const body = {
    AppName: "OWA",
    Scenario: { Name: "owa.react.compose" },
    Cvid: crypto.randomUUID(),
    EntityRequests: [
      {
        Query: { QueryString: query },
        EntityType: "People",
        Provenances: ["Mailbox", "Directory"],
        Size: size,
        Fields: ["DisplayName", "EmailAddresses", "JobTitle", "PeopleSubtype"],
        Filter: { Term: { Flags: "NonHidden" } },
      },
    ],
  };

  const res = await fetch(
    "https://outlook.cloud.microsoft/search/api/v1/suggestions?scenario=owa.react.compose&n=81",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) return [];
  const data = await res.json();

  const results: { name: string; email: string; type: string }[] = [];
  for (const group of data.Groups || []) {
    for (const s of group.Suggestions || []) {
      const email = s.EmailAddresses?.[0];
      if (email) results.push({ name: s.DisplayName || "", email, type: s.PeopleSubtype || s.PersonType || "" });
    }
  }
  return results;
}
