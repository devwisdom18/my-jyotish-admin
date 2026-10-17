const COOKIE_NAME = "__Host-pds_admin";
const SESSION_SECONDS = 60 * 60 * 8;
const PBKDF2_ITERATIONS = 310000;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}
function corsHeaders(request) {
  // Same-origin deployment is recommended. Do not add wildcard CORS for admin APIs.
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  const headers = { "Vary": "Origin" };
  if (origin && new URL(origin).host === url.host) headers["Access-Control-Allow-Origin"] = origin;
  headers["Access-Control-Allow-Credentials"] = "true";
  headers["Access-Control-Allow-Headers"] = "Content-Type";
  headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS";
  return headers;
}
function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromB64url(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
async function hmac(value, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}
async function makeSession(secret) {
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ admin: true, exp: Math.floor(Date.now()/1000) + SESSION_SECONDS })));
  return `${payload}.${b64url(await hmac(payload, secret))}`;
}
async function validSession(request, secret) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.split(";").map(x => x.trim()).find(x => x.startsWith(COOKIE_NAME + "="));
  if (!match) return false;
  const token = match.slice(COOKIE_NAME.length + 1);
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const expected = b64url(await hmac(parts[0], secret));
  if (expected.length !== parts[1].length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ parts[1].charCodeAt(i);
  if (diff !== 0) return false;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(parts[0])));
    return payload.admin === true && payload.exp > Math.floor(Date.now()/1000);
  } catch { return false; }
}
async function verifyPassword(password, stored) {
  // stored format: pbkdf2$iterations$saltBase64Url$hashBase64Url
  const p = String(stored || "").split("$");
  if (p.length !== 4 || p[0] !== "pbkdf2") return false;
  const iterations = Number(p[1]);
  if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000) return false;
  const salt = fromB64url(p[2]);
  const expected = fromB64url(p[3]);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, expected.length * 8));
  if (bits.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ expected[i];
  return diff === 0;
}
function cookieHeader(value, maxAge) {
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}
function clearCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
function cleanString(value, max = 12000) {
  return String(value ?? "").trim().slice(0, max);
}
function makeId() { return crypto.randomUUID(); }

const TABLE_FIELDS = {
  astrologers: ["name", "experience", "speciality", "contact", "photo_url"],
  products: ["name", "price", "description", "photo_url"],
  blogs: ["title", "category", "excerpt", "content", "photo_url"],
};
// Use new, prefixed tables so the existing website's tables are never modified.
const DB_TABLES = {
  astrologers: "secure_astrologers",
  products: "secure_products",
  blogs: "secure_blogs",
};
function safeRecord(table, body) {
  const allowed = TABLE_FIELDS[table];
  const out = {};
  for (const field of allowed) out[field] = cleanString(body[field], field === "content" ? 30000 : field === "photo_url" ? 2000 : 4000);
  const required = table === "blogs" ? ["title", "content"] : ["name"];
  if (table === "products") required.splice(0, 1, "name");
  for (const field of required) if (!out[field]) throw new Error(`कृपया ${field} भरें।`);
  return out;
}
async function readBody(request) {
  try { return await request.json(); } catch { throw new Error("अनुरोध का डेटा सही नहीं है।"); }
}
async function listRows(env, table) {
  const dbTable = DB_TABLES[table];
  if (!dbTable) throw new Error("तालिका उपलब्ध नहीं है।");
  return await env.DB.prepare(`SELECT * FROM ${dbTable} ORDER BY created_at DESC`).all();
}
async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();
  const cors = corsHeaders(request);

  if (method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  if (path === "/api/login" && method === "POST") {
    const body = await readBody(request);
    const password = String(body.password || "");
    if (!env.ADMIN_PASSWORD_HASH || !env.SESSION_SECRET) return json({ error: "सर्वर का admin secret अभी सेट नहीं है।" }, 503, cors);
    if (password.length < 1 || password.length > 200 || !(await verifyPassword(password, env.ADMIN_PASSWORD_HASH))) {
      return json({ error: "पासवर्ड सही नहीं है।" }, 401, cors);
    }
    const token = await makeSession(env.SESSION_SECRET);
    return json({ ok: true }, 200, { ...cors, "Set-Cookie": cookieHeader(token, SESSION_SECONDS) });
  }
  if (path === "/api/logout" && method === "POST") {
    return json({ ok: true }, 200, { ...cors, "Set-Cookie": clearCookie() });
  }
  if (path === "/api/me" && method === "GET") {
    return json({ authenticated: !!(env.SESSION_SECRET && await validSession(request, env.SESSION_SECRET)) }, 200, cors);
  }

  const collectionMatch = path.match(/^\/api\/(astrologers|products|blogs)$/);
  const itemMatch = path.match(/^\/api\/(astrologers|products|blogs)\/([a-f0-9-]{36})$/i);
  if (collectionMatch) {
    const table = collectionMatch[1];
    if (method === "GET") {
      const result = await listRows(env, table);
      return json(result.results || [], 200, cors);
    }
    if (["POST"].includes(method)) {
      if (!env.SESSION_SECRET || !(await validSession(request, env.SESSION_SECRET))) return json({ error: "एडमिन लॉगिन आवश्यक है।" }, 401, cors);
      const body = await readBody(request);
      const record = safeRecord(table, body);
      const id = makeId();
      const dbTable = DB_TABLES[table];
      const fields = ["id", ...TABLE_FIELDS[table]];
      const values = [id, ...TABLE_FIELDS[table].map(k => record[k] || "")];
      const placeholders = fields.map(() => "?").join(",");
      await env.DB.prepare(`INSERT INTO ${dbTable} (${fields.join(",")}) VALUES (${placeholders})`).bind(...values).run();
      return json({ ok: true, id }, 201, cors);
    }
  }
  if (itemMatch) {
    const table = itemMatch[1], id = itemMatch[2];
    if (!env.SESSION_SECRET || !(await validSession(request, env.SESSION_SECRET))) return json({ error: "एडमिन लॉगिन आवश्यक है।" }, 401, cors);
    if (method === "DELETE") {
      await env.DB.prepare(`DELETE FROM ${DB_TABLES[table]} WHERE id = ?`).bind(id).run();
      return json({ ok: true }, 200, cors);
    }
    if (method === "PUT") {
      const body = await readBody(request);
      const record = safeRecord(table, body);
      const fields = TABLE_FIELDS[table];
      const setters = fields.map(k => `${k} = ?`).join(", ");
      await env.DB.prepare(`UPDATE ${DB_TABLES[table]} SET ${setters} WHERE id = ?`).bind(...fields.map(k => record[k] || ""), id).run();
      return json({ ok: true }, 200, cors);
    }
  }
  return json({ error: "API route नहीं मिला।" }, 404, cors);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") return Response.redirect(new URL("/admin.html", url), 302);
    if (!url.pathname.startsWith("/api/")) {
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return new Response("Not found", { status: 404 });
    }
    try {
      return await handleApi(request, env);
    } catch (err) {
      return json({ error: err?.message || "सर्वर में समस्या आई।" }, 400, corsHeaders(request));
    }
  },
};
