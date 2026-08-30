import { createServer } from "node:http";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";

const SITE_HOST = "borfrezy.in.ua";
const SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];
const TOKEN_PATH = "secrets/google-token.json";
const REPORT_DATE = new Date().toISOString().slice(0, 10);
const REPORT_JSON = `reports/gsc-audit-${REPORT_DATE}.json`;
const REPORT_MD = `reports/gsc-audit-${REPORT_DATE}.md`;

function b64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function findClient() {
  const files = await readdir("secrets");
  const name = files.find((f) => f === "google-oauth-client.json")
    || files.find((f) => f.startsWith("client_secret_") && f.endsWith(".json"));
  if (!name) throw new Error("OAuth client JSON not found in secrets/");

  const raw = JSON.parse(await readFile(`secrets/${name}`, "utf8"));
  const client = raw.installed || raw.web;
  if (!client?.client_id) throw new Error("OAuth client JSON does not contain client_id");
  return { name, client };
}

async function readToken() {
  try {
    return JSON.parse(await readFile(TOKEN_PATH, "utf8"));
  } catch {
    return null;
  }
}

async function tokenRequest(body) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Token request failed ${res.status}: ${text}`);
  return JSON.parse(text);
}

async function refreshToken(client, token) {
  if (!token.refresh_token) return null;
  const next = await tokenRequest({
    client_id: client.client_id,
    client_secret: client.client_secret || "",
    refresh_token: token.refresh_token,
    grant_type: "refresh_token",
  });
  return {
    ...token,
    ...next,
    refresh_token: token.refresh_token,
    expiry_date: Date.now() + next.expires_in * 1000,
  };
}

async function authorize(client) {
  const existing = await readToken();
  if (existing?.access_token && existing.expiry_date > Date.now() + 60_000) return existing;
  if (existing?.refresh_token) {
    const refreshed = await refreshToken(client, existing);
    if (refreshed) {
      await writeFile(TOKEN_PATH, JSON.stringify(refreshed, null, 2));
      return refreshed;
    }
  }

  const verifier = b64url(randomBytes(48));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const port = 53682;
  const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", client.client_id);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES.join(" "));
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  console.log("\nOpen this URL in your browser and approve access:\n");
  console.log(authUrl.toString());
  console.log("\nWaiting for Google callback on 127.0.0.1...\n");

  const code = await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, redirectUri);
      if (url.pathname !== "/oauth2callback") {
        res.writeHead(404).end("Not found");
        return;
      }
      if (url.searchParams.get("error")) {
        res.writeHead(400).end("Authorization failed. You can close this tab.");
        server.close();
        reject(new Error(url.searchParams.get("error")));
        return;
      }
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Authorization complete. You can close this tab and return to Codex.");
      server.close();
      resolve(url.searchParams.get("code"));
    });
    server.listen(port, "127.0.0.1");
  });

  const token = await tokenRequest({
    client_id: client.client_id,
    client_secret: client.client_secret || "",
    code,
    code_verifier: verifier,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const saved = { ...token, expiry_date: Date.now() + token.expires_in * 1000 };
  await writeFile(TOKEN_PATH, JSON.stringify(saved, null, 2));
  return saved;
}

async function api(token, url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error(`API ${res.status} ${url}: ${text}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function searchAnalytics(token, siteUrl, body) {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  return api(token, url, { method: "POST", body: JSON.stringify(body) });
}

async function inspectUrl(token, siteUrl, inspectionUrl) {
  try {
    return await api(token, "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
      method: "POST",
      body: JSON.stringify({ siteUrl, inspectionUrl, languageCode: "ru-RU" }),
    });
  } catch (error) {
    return { error: error.message, status: error.status, data: error.data };
  }
}

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function table(rows, cols) {
  const head = `| ${cols.join(" | ")} |`;
  const sep = `| ${cols.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${cols.map((c) => String(row[c] ?? "")).join(" | ")} |`);
  return [head, sep, ...body].join("\n");
}

const { name, client } = await findClient();
const token = await authorize(client);

await mkdir("reports", { recursive: true });

const sites = await api(token, "https://www.googleapis.com/webmasters/v3/sites");
const siteEntries = sites.siteEntry || [];
const preferred = siteEntries.find((s) => s.siteUrl === `sc-domain:${SITE_HOST}`)
  || siteEntries.find((s) => s.siteUrl === `https://${SITE_HOST}/`)
  || siteEntries.find((s) => s.siteUrl.includes(SITE_HOST));
if (!preferred) {
  throw new Error(`No Search Console property found for ${SITE_HOST}. Available: ${siteEntries.map((s) => s.siteUrl).join(", ")}`);
}

const siteUrl = preferred.siteUrl;
const startDate = daysAgo(90);
const endDate = daysAgo(1);

const overview = await searchAnalytics(token, siteUrl, {
  startDate,
  endDate,
  dimensions: ["date"],
  rowLimit: 250,
});
const queries = await searchAnalytics(token, siteUrl, {
  startDate,
  endDate,
  dimensions: ["query"],
  rowLimit: 50,
});
const pages = await searchAnalytics(token, siteUrl, {
  startDate,
  endDate,
  dimensions: ["page"],
  rowLimit: 50,
});
const devices = await searchAnalytics(token, siteUrl, {
  startDate,
  endDate,
  dimensions: ["device"],
  rowLimit: 10,
});
const countries = await searchAnalytics(token, siteUrl, {
  startDate,
  endDate,
  dimensions: ["country"],
  rowLimit: 20,
});

let sitemaps;
try {
  sitemaps = await api(token, `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps`);
} catch (error) {
  sitemaps = { error: error.message };
}

const inspections = {};
for (const url of [
  `https://${SITE_HOST}/ua/`,
  `https://${SITE_HOST}/ru/`,
  `https://${SITE_HOST}/ua/borfrezy/`,
  `https://${SITE_HOST}/ua/borfrezy/ax0616m06/`,
  `https://${SITE_HOST}/sitemap.xml`,
]) {
  inspections[url] = await inspectUrl(token, siteUrl, url);
}

const totals = (overview.rows || []).reduce((acc, row) => {
  acc.clicks += row.clicks || 0;
  acc.impressions += row.impressions || 0;
  return acc;
}, { clicks: 0, impressions: 0 });
totals.ctr = totals.impressions ? totals.clicks / totals.impressions : 0;

function compactRows(response, keyName) {
  return (response.rows || []).map((row) => ({
    [keyName]: row.keys?.[0],
    clicks: Math.round(row.clicks || 0),
    impressions: Math.round(row.impressions || 0),
    ctr: `${((row.ctr || 0) * 100).toFixed(2)}%`,
    position: (row.position || 0).toFixed(1),
  }));
}

const report = {
  generatedAt: new Date().toISOString(),
  credentialFile: name,
  siteUrl,
  period: { startDate, endDate },
  sites: siteEntries,
  totals,
  queries: compactRows(queries, "query"),
  pages: compactRows(pages, "page"),
  devices: compactRows(devices, "device"),
  countries: compactRows(countries, "country"),
  sitemaps,
  inspections,
};

await writeFile(REPORT_JSON, JSON.stringify(report, null, 2));

const md = [
  "# Google Search Console audit",
  "",
  `Property: ${siteUrl}`,
  `Period: ${startDate} to ${endDate}`,
  `Clicks: ${Math.round(totals.clicks)}`,
  `Impressions: ${Math.round(totals.impressions)}`,
  `CTR: ${(totals.ctr * 100).toFixed(2)}%`,
  "",
  "## Top queries",
  table(report.queries.slice(0, 20), ["query", "clicks", "impressions", "ctr", "position"]),
  "",
  "## Top pages",
  table(report.pages.slice(0, 20), ["page", "clicks", "impressions", "ctr", "position"]),
  "",
  "## Devices",
  table(report.devices, ["device", "clicks", "impressions", "ctr", "position"]),
  "",
  "## Countries",
  table(report.countries, ["country", "clicks", "impressions", "ctr", "position"]),
  "",
  "## URL inspection summary",
  ...Object.entries(inspections).map(([url, value]) => {
    const result = value.inspectionResult?.indexStatusResult;
    return `- ${url}: ${result?.coverageState || value.error || "unknown"}; Google canonical: ${result?.googleCanonical || "n/a"}; user canonical: ${result?.userCanonical || "n/a"}`;
  }),
  "",
].join("\n");
await writeFile(REPORT_MD, md);

console.log(JSON.stringify({
  siteUrl,
  period: { startDate, endDate },
  clicks: Math.round(totals.clicks),
  impressions: Math.round(totals.impressions),
  ctr: `${(totals.ctr * 100).toFixed(2)}%`,
  reportJson: REPORT_JSON,
  reportMd: REPORT_MD,
}, null, 2));
