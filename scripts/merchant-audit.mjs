import { createServer } from "node:http";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";

const MERCHANT_ID = process.env.MERCHANT_ID || "5800594806";
const SCOPES = ["https://www.googleapis.com/auth/content"];
const TOKEN_PATH = "secrets/google-merchant-token.json";
const REPORT_DATE = new Date().toISOString().slice(0, 10);
const REPORT_JSON = `reports/merchant-audit-${REPORT_DATE}.json`;
const REPORT_MD = `reports/merchant-audit-${REPORT_DATE}.md`;

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

function hasScopes(token) {
  const granted = String(token?.scope || "").split(/\s+/);
  return SCOPES.every((scope) => granted.includes(scope));
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
  const refreshed = {
    ...token,
    ...next,
    refresh_token: token.refresh_token,
    expiry_date: Date.now() + next.expires_in * 1000,
  };
  return hasScopes(refreshed) ? refreshed : null;
}

async function authorize(client) {
  const existing = await readToken();
  if (existing?.access_token && existing.expiry_date > Date.now() + 60_000 && hasScopes(existing)) {
    return existing;
  }
  if (existing?.refresh_token) {
    const refreshed = await refreshToken(client, existing);
    if (refreshed) {
      await writeFile(TOKEN_PATH, JSON.stringify(refreshed, null, 2));
      return refreshed;
    }
  }

  const verifier = b64url(randomBytes(48));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const port = 53683;
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

  console.log("\nOpen this URL in your browser and approve Merchant Center access:\n");
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
      res.end("Merchant authorization complete. You can close this tab and return to Codex.");
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

async function safe(name, fn) {
  try {
    return await fn();
  } catch (error) {
    return { error: error.message, status: error.status, data: error.data };
  }
}

async function listPages(token, url, resourceKey, pageParam = "pageToken", nextKey = "nextPageToken", limit = 1000) {
  const out = [];
  let pageToken = "";
  while (out.length < limit) {
    const pageUrl = new URL(url);
    if (pageToken) pageUrl.searchParams.set(pageParam, pageToken);
    const data = await api(token, pageUrl.toString());
    out.push(...(data[resourceKey] || []));
    pageToken = data[nextKey];
    if (!pageToken) break;
  }
  return out;
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item) || "unknown";
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, count }));
}

function table(rows, cols) {
  if (!rows.length) return "_No rows._";
  return [
    `| ${cols.join(" | ")} |`,
    `| ${cols.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${cols.map((c) => String(row[c] ?? "").replace(/\|/g, "\\|")).join(" | ")} |`),
  ].join("\n");
}

const { name, client } = await findClient();
const token = await authorize(client);
await mkdir("reports", { recursive: true });

const base = `https://shoppingcontent.googleapis.com/content/v2.1`;
const authinfo = await safe("authinfo", () => api(token, `${base}/accounts/authinfo`));
const account = await safe("account", () => api(token, `${base}/${MERCHANT_ID}/accounts/${MERCHANT_ID}`));
const accountStatus = await safe("accountStatus", () => api(token, `${base}/${MERCHANT_ID}/accountstatuses/${MERCHANT_ID}`));
const datafeeds = await safe("datafeeds", () => api(token, `${base}/${MERCHANT_ID}/datafeeds`));
const products = await safe("products", () => listPages(token, `${base}/${MERCHANT_ID}/products?maxResults=250`, "resources", "pageToken", "nextPageToken", 1000));
const productStatuses = await safe("productStatuses", () => listPages(token, `${base}/${MERCHANT_ID}/productstatuses?maxResults=250`, "resources", "pageToken", "nextPageToken", 1000));

const statusItems = Array.isArray(productStatuses) ? productStatuses : [];
const productItems = Array.isArray(products) ? products : [];
const issueRows = [];
for (const status of statusItems) {
  for (const issue of status.itemLevelIssues || []) {
    issueRows.push({
      productId: status.productId,
      title: status.title,
      code: issue.code,
      servability: issue.servability,
      resolution: issue.resolution,
      attribute: issue.attributeName,
      destination: issue.destination,
      description: issue.description,
      detail: issue.detail,
      documentation: issue.documentation,
      countries: (issue.applicableCountries || []).join(", "),
    });
  }
}

const destinationRows = [];
for (const status of statusItems) {
  for (const destination of status.destinationStatuses || []) {
    destinationRows.push({
      productId: status.productId,
      title: status.title,
      destination: destination.destination,
      status: destination.status,
      approved: (destination.approvedCountries || []).join(", "),
      disapproved: (destination.disapprovedCountries || []).join(", "),
      pending: (destination.pendingCountries || []).join(", "),
    });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  credentialFile: name,
  merchantId: MERCHANT_ID,
  authinfo,
  account,
  accountStatus,
  datafeeds,
  productCount: productItems.length,
  productStatusCount: statusItems.length,
  issueCount: issueRows.length,
  destinationSummary: countBy(destinationRows, (r) => `${r.destination}:${r.status}`),
  issueSummary: countBy(issueRows, (r) => `${r.code} | ${r.description}`),
  products: productItems,
  productStatuses: statusItems,
  issues: issueRows,
  destinationRows,
};

await writeFile(REPORT_JSON, JSON.stringify(report, null, 2));

const issueSummary = report.issueSummary.map((row) => ({ issue: row.key, count: row.count })).slice(0, 30);
const destinationSummary = report.destinationSummary.map((row) => ({ status: row.key, count: row.count }));
const topIssues = issueRows.slice(0, 50).map((issue) => ({
  code: issue.code,
  product: issue.title,
  attribute: issue.attribute,
  description: issue.description,
  detail: issue.detail,
}));

const md = [
  "# Google Merchant Center audit",
  "",
  `Merchant ID: ${MERCHANT_ID}`,
  `Generated: ${report.generatedAt}`,
  `Products returned: ${report.productCount}`,
  `Product statuses returned: ${report.productStatusCount}`,
  `Item-level issues returned: ${report.issueCount}`,
  "",
  "## Destination Summary",
  table(destinationSummary, ["status", "count"]),
  "",
  "## Issue Summary",
  table(issueSummary, ["issue", "count"]),
  "",
  "## First Item Issues",
  table(topIssues, ["code", "product", "attribute", "description", "detail"]),
  "",
].join("\n");

await writeFile(REPORT_MD, md);

console.log(JSON.stringify({
  merchantId: MERCHANT_ID,
  productCount: report.productCount,
  productStatusCount: report.productStatusCount,
  issueCount: report.issueCount,
  reportJson: REPORT_JSON,
  reportMd: REPORT_MD,
}, null, 2));
