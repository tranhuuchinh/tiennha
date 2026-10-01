import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

type Creds = { client_email: string; private_key: string };

export function readGoogleCreds(): Creds | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (raw) {
    const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(json);
    return { client_email: parsed.client_email, private_key: parsed.private_key };
  }
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE?.trim();
  if (file) {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return { client_email: parsed.client_email, private_key: parsed.private_key };
  }
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (email && key) return { client_email: email, private_key: key.replace(/\\n/g, "\n") };
  return null;
}

export class SheetsError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

let tokenCache: { token: string; exp: number; email: string } | null = null;

async function accessToken(creds: Creds) {
  if (tokenCache && tokenCache.email === creds.client_email && tokenCache.exp > Date.now() + 60_000) {
    return tokenCache.token;
  }
  const now = Math.floor(Date.now() / 1000);
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${enc({ alg: "RS256", typ: "JWT" })}.${enc({
    iss: creds.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(creds.private_key, "base64url");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new SheetsError(`Không lấy được token Google (${res.status}): ${await res.text()}`, 500);
  }
  const body = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: body.access_token, exp: Date.now() + body.expires_in * 1000, email: creds.client_email };
  return body.access_token;
}

export type CellValue = string | number | boolean;

export class SheetsClient {
  constructor(
    private spreadsheetId: string,
    private creds: Creds,
  ) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await accessToken(this.creds);
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 403) {
        throw new SheetsError(
          `Service account ${this.creds.client_email} chưa có quyền Editor trên Google Sheet.`,
          403,
        );
      }
      if (res.status === 404) throw new SheetsError("Không tìm thấy Google Sheet, kiểm tra GOOGLE_SHEET_ID.", 404);
      throw new SheetsError(`Google Sheets lỗi ${res.status}: ${text}`, res.status);
    }
    return (await res.json()) as T;
  }

  sheetProperties() {
    return this.request<{ sheets: { properties: { sheetId: number; title: string } }[] }>(
      "?fields=sheets.properties(sheetId,title)",
    );
  }

  async batchGet(ranges: string[]): Promise<CellValue[][][]> {
    const qs = new URLSearchParams({ valueRenderOption: "UNFORMATTED_VALUE" });
    for (const r of ranges) qs.append("ranges", r);
    const res = await this.request<{ valueRanges: { values?: CellValue[][] }[] }>(`/values:batchGet?${qs}`);
    return res.valueRanges.map((v) => v.values ?? []);
  }

  async get(range: string): Promise<CellValue[][]> {
    const [values] = await this.batchGet([range]);
    return values;
  }

  update(range: string, values: CellValue[][]) {
    return this.request(`/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ values }),
    });
  }

  append(range: string, values: CellValue[][]) {
    return this.request(
      `/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: "POST", body: JSON.stringify({ values }) },
    );
  }

  clear(range: string) {
    return this.request(`/values/${encodeURIComponent(range)}:clear`, { method: "POST", body: "{}" });
  }

  batchUpdate(requests: object[]) {
    return this.request<{ replies: { addSheet?: { properties: { sheetId: number; title: string } } }[] }>(
      ":batchUpdate",
      { method: "POST", body: JSON.stringify({ requests }) },
    );
  }
}
