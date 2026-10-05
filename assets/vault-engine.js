// GOLDITY Design Vault - server side (Phase 1: gallery, points, unlock, signed downloads, admin).
//
// This module is imported by worker.js and receives the Worker's own helper functions through
// createVault(helpers), so it shares the same session handling, origin checks and rate limiter
// as the rest of the site. Nothing in here runs unless a request path starts with
//   /api/vault/   /api/admin/vault/   /vault/
// so a bug in this file can never affect registration, login, referral or airdrop routes.

const enc = new TextEncoder();

// ---------------------------------------------------------------------------------------------
// Schema. Every statement is idempotent (IF NOT EXISTS / INSERT OR IGNORE) and is a single SQL
// statement, because the D1 console only accepts one statement per run. The admin "Set up
// database" button (POST /api/admin/vault/setup) executes this exact list, and
// migrations/010_design_vault.sql is generated from it, so the two can never drift apart.
// ---------------------------------------------------------------------------------------------
export const VAULT_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS vault_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS vault_categories (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  size_kind TEXT NOT NULL DEFAULT 'none',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  free_limit INTEGER,
  cad_stones_cents INTEGER NOT NULL DEFAULT 0,
  cad_plain_cents INTEGER NOT NULL DEFAULT 0,
  cad_custom_cents INTEGER NOT NULL DEFAULT 0
)`,
  `CREATE TABLE IF NOT EXISTS vault_styles (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
)`,
  `CREATE TABLE IF NOT EXISTS vault_images (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  has_stones INTEGER NOT NULL DEFAULT 0,
  is_free INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden','deleted')),
  original_key TEXT NOT NULL,
  preview_key TEXT NOT NULL,
  demo_key TEXT NOT NULL,
  original_type TEXT NOT NULL,
  original_bytes INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  uploaded_by TEXT,
  created_at TEXT NOT NULL,
  published_at TEXT,
  updated_at TEXT NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS idx_vault_images_list ON vault_images(status, category, published_at)`,
  `CREATE TABLE IF NOT EXISTS vault_image_styles (
  image_id TEXT NOT NULL,
  style_slug TEXT NOT NULL,
  PRIMARY KEY (image_id, style_slug)
)`,
  `CREATE INDEX IF NOT EXISTS idx_vault_image_styles_style ON vault_image_styles(style_slug)`,
  `CREATE TABLE IF NOT EXISTS vault_points_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  amount INTEGER NOT NULL,
  remaining INTEGER NOT NULL DEFAULT 0 CHECK (remaining >= 0),
  expires_at TEXT,
  ref_type TEXT,
  ref_id TEXT,
  note TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS idx_vault_points_user ON vault_points_ledger(user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_vault_points_lots ON vault_points_ledger(user_id, expires_at) WHERE remaining > 0`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_vault_points_gift ON vault_points_ledger(user_id, ref_type, ref_id) WHERE kind = 'gift'`,
  `CREATE TABLE IF NOT EXISTS vault_credit_accounts (
  user_id TEXT PRIMARY KEY,
  balance_cents INTEGER NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  updated_at TEXT NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS vault_credit_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  ref_type TEXT,
  ref_id TEXT,
  note TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS idx_vault_credit_user ON vault_credit_ledger(user_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS vault_unlocks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  image_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  points_spent INTEGER NOT NULL,
  unlocked_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  UNIQUE (user_id, image_id, seq)
)`,
  `CREATE INDEX IF NOT EXISTS idx_vault_unlocks_user ON vault_unlocks(user_id, expires_at)`,
  `CREATE TABLE IF NOT EXISTS vault_downloads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  image_id TEXT NOT NULL,
  downloaded_at TEXT NOT NULL,
  ip_hash TEXT
)`,
  `CREATE INDEX IF NOT EXISTS idx_vault_downloads_user ON vault_downloads(user_id, downloaded_at)`,
  `CREATE TABLE IF NOT EXISTS vault_admin_log (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  old_value TEXT,
  new_value TEXT,
  note TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS idx_vault_admin_log_time ON vault_admin_log(created_at)`,
  // Seed data. INSERT OR IGNORE so re-running never overwrites values the admin has edited.
  `INSERT OR IGNORE INTO vault_categories(slug,name,size_kind,sort_order,cad_stones_cents,cad_plain_cents,cad_custom_cents) VALUES
  ('ring','Ring','ring_eu',10,3000,2000,5000),
  ('wedding-band','Wedding band','ring_eu',20,3000,2000,5000),
  ('earring','Earring','none',30,3000,2000,5000),
  ('piercing','Piercing','none',40,3000,2000,5000),
  ('necklace-pendant','Necklace & pendant','none',50,3000,2000,5000),
  ('bracelet-bangle','Bracelet & bangle','bangle_or_bracelet',60,3000,2000,5000),
  ('brooch','Brooch','none',70,3000,2000,5000),
  ('watch-charm','Watch charm','none',80,3000,2000,5000),
  ('set','Set','none',90,5000,4000,7000)`,
  `INSERT OR IGNORE INTO vault_styles(slug,name,sort_order) VALUES
  ('luxury','Luxury',10),('minimal','Minimal',20),('classic','Classic',30),('abstract','Abstract',40),
  ('nature','Nature',50),('geometric','Geometric',60),('modern','Modern',70)`
];

// ---------------------------------------------------------------------------------------------
// Admin-editable numeric settings (stored in vault_settings, validated on read and on write).
// An invalid or missing stored value silently falls back to the default - never to 0.
// ---------------------------------------------------------------------------------------------
export const SETTING_DEFS = {
  launched: { def: 0, min: 0, max: 1, label: "Vault is open to the public" },
  unlock_cost_points: { def: 15, min: 1, max: 100000, label: "Points to unlock one image" },
  unlock_days: { def: 30, min: 1, max: 3650, label: "Days an unlocked image stays open" },
  points_expiry_months: { def: 12, min: 1, max: 120, label: "Months until new points expire" },
  gift_email_points: { def: 15, min: 0, max: 100000, label: "Gift points for a verified email" },
  gift_wallet_points: { def: 15, min: 0, max: 100000, label: "Gift points for a verified wallet" },
  free_per_category: { def: 5, min: 0, max: 200, label: "Free images allowed per category" }
};

const LIMITS = {
  originalBytes: 30 * 1024 * 1024,
  demoBytes: 8 * 1024 * 1024,
  previewBytes: 3 * 1024 * 1024,
  requestBytes: 45 * 1024 * 1024,
  previewMaxSide: 1000,
  demoMaxSide: 2000,
  pageSize: 24,
  downloadLinkTtlSec: 300,
  downloadsPerHour: 120
};

const ID_RE = /^[a-z0-9]{10}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

// ----------------------------------------------------------------------------- pure helpers

export function intIn(v, def, min, max) {
  if (v === undefined || v === null || String(v).trim() === "") return def;
  const n = Number(v);
  return Number.isFinite(n) && Number.isInteger(n) && n >= min && n <= max ? n : def;
}

export function addMonths(date, n) {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const dim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, dim));
  return d;
}

// Consume points from lots that expire first. Returns null when the lots cannot cover `need`.
export function planSpend(lots, need) {
  const plan = [];
  let left = need;
  for (const l of lots) {
    if (left <= 0) break;
    const take = Math.min(Number(l.remaining), left);
    if (take > 0) {
      plan.push({ id: l.id, take });
      left -= take;
    }
  }
  return left > 0 ? null : plan;
}

// Look at the real bytes of an upload instead of trusting the file name or declared type.
export function sniffImage(b) {
  if (!b || b.length < 30) return null;
  // PNG
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) {
    if (b[12] !== 0x49 || b[13] !== 0x48 || b[14] !== 0x44 || b[15] !== 0x52) return null;
    const w = ((b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19]) >>> 0;
    const h = ((b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23]) >>> 0;
    return w && h ? { type: "png", ext: "png", mime: "image/png", width: w, height: h } : null;
  }
  // JPEG
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xff) { i++; continue; }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      if (m === 0xd9) break;
      const len = (b[i + 2] << 8) | b[i + 3];
      if (len < 2) return null;
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        const h = (b[i + 5] << 8) | b[i + 6];
        const w = (b[i + 7] << 8) | b[i + 8];
        return w && h ? { type: "jpeg", ext: "jpg", mime: "image/jpeg", width: w, height: h } : null;
      }
      i += 2 + len;
    }
    return null;
  }
  // WebP (still images only)
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    const fourcc = String.fromCharCode(b[12], b[13], b[14], b[15]);
    let w = 0, h = 0;
    if (fourcc === "VP8 ") {
      if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
      w = (b[26] | (b[27] << 8)) & 0x3fff;
      h = (b[28] | (b[29] << 8)) & 0x3fff;
    } else if (fourcc === "VP8L") {
      if (b[20] !== 0x2f) return null;
      w = 1 + (((b[22] & 0x3f) << 8) | b[21]);
      h = 1 + (((b[24] & 0x0f) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6));
    } else if (fourcc === "VP8X") {
      if (b[20] & 0x02) return null; // animated
      w = 1 + (b[24] | (b[25] << 8) | (b[26] << 16));
      h = 1 + (b[27] | (b[28] << 8) | (b[29] << 16));
    } else return null;
    return w && h ? { type: "webp", ext: "webp", mime: "image/webp", width: w, height: h } : null;
  }
  return null;
}

function newImageId() {
  const r = crypto.getRandomValues(new Uint8Array(10));
  let s = "";
  for (const x of r) s += ID_ALPHABET[x % 36];
  return s;
}

function hex(buf) {
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function sha256Bytes(bytes) {
  return hex(await crypto.subtle.digest("SHA-256", bytes));
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

function safeEq(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function likeEscape(s) {
  return s.replace(/[\\%_]/g, (m) => "\\" + m);
}

function cleanText(v, max) {
  return String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export function treasuryAddresses(env, payoutAddress) {
  const set = new Set();
  for (const part of String(env.VAULT_TREASURY_ADDRESS || "").split(",")) {
    const a = part.trim().toLowerCase();
    if (/^0x[a-f0-9]{40}$/.test(a)) set.add(a);
  }
  // The hot wallet that pays referral rewards must never double as the treasury.
  if (payoutAddress && set.has(String(payoutAddress).toLowerCase())) {
    console.error("GOLDITY vault: VAULT_TREASURY_ADDRESS equals the referral payout wallet - treasury disabled");
    return new Set();
  }
  return set;
}

// ----------------------------------------------------------------------------- engine

export function createVault(h) {
  const { out, cors, currentUser, requireOrigin, rateLimit, ip, ipBucket, hashIp, sha256Text, nowIso, id, htmlEscape } = h;

  const J = (e, data, status = 200) => out(data, status, cors(e));
  const notFound = (e) => J(e, { ok: false, error: "not_found" }, 404);

  async function getSettings(e) {
    const s = {};
    for (const [k, d] of Object.entries(SETTING_DEFS)) s[k] = d.def;
    const rows = await e.DB.prepare("SELECT key,value FROM vault_settings").all();
    for (const r of rows.results || []) {
      const d = SETTING_DEFS[r.key];
      if (d) s[r.key] = intIn(r.value, d.def, d.min, d.max);
    }
    return s;
  }

  async function gate(e, req) {
    const settings = await getSettings(e);
    const user = await currentUser(e, req);
    const isAdmin = !!user && user.role === "admin";
    return { settings, user, isAdmin, open: settings.launched === 1 || isAdmin };
  }

  async function requireAdmin(e, req, { write }) {
    const user = await currentUser(e, req);
    if (!user || user.role !== "admin") return { err: J(e, { ok: false, error: "unauthorized" }, 401) };
    if (write && !await requireOrigin(e, req)) return { err: J(e, { ok: false, error: "forbidden" }, 403) };
    if (write && !await rateLimit(e, `vadmin:${user.id}`, 240, 6e4)) return { err: J(e, { ok: false, error: "rate_limited" }, 429) };
    return { user };
  }

  async function logStmt(e, req, admin, action, targetType, targetId, oldV, newV, note) {
    const ipHash = await hashIp(e, ipBucket(ip(req)));
    return e.DB.prepare(
      "INSERT INTO vault_admin_log(id,admin_id,action,target_type,target_id,old_value,new_value,note,ip_hash,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)"
    ).bind(id(), admin.id, action, targetType ?? null, targetId ?? null,
      oldV === undefined ? null : JSON.stringify(oldV), newV === undefined ? null : JSON.stringify(newV), note ?? null, ipHash, nowIso());
  }

  async function auditStmt(e, req, admin, action) {
    const ipHash = await hashIp(e, ipBucket(ip(req)));
    return e.DB.prepare("INSERT INTO audit_log(id,user_id,event_type,ip_hash,created_at) VALUES(?,?,?,?,?)")
      .bind(id(), admin.id, `vault_admin:${action}`.slice(0, 60), ipHash, nowIso());
  }

  // ------------------------------------------------------------------ points helpers

  async function validLots(e, userId, now) {
    const r = await e.DB.prepare(
      "SELECT id,remaining,expires_at FROM vault_points_ledger WHERE user_id=? AND remaining>0 AND expires_at>? ORDER BY expires_at ASC, created_at ASC, id ASC LIMIT 500"
    ).bind(userId, now).all();
    return r.results || [];
  }

  async function pointsSummary(e, userId) {
    const now = nowIso();
    const bal = await e.DB.prepare("SELECT COALESCE(SUM(remaining),0) AS p FROM vault_points_ledger WHERE user_id=? AND remaining>0 AND expires_at>?").bind(userId, now).first();
    const next = await e.DB.prepare("SELECT expires_at, SUM(remaining) AS p FROM vault_points_ledger WHERE user_id=? AND remaining>0 AND expires_at>? GROUP BY expires_at ORDER BY expires_at ASC LIMIT 1").bind(userId, now).first();
    const credit = await e.DB.prepare("SELECT balance_cents FROM vault_credit_accounts WHERE user_id=?").bind(userId).first();
    return {
      balance: Number(bal?.p || 0),
      nextExpiry: next ? { points: Number(next.p), at: next.expires_at } : null,
      creditCents: Number(credit?.balance_cents || 0)
    };
  }

  async function ensureGifts(e, user, S) {
    const have = await e.DB.prepare("SELECT ref_id FROM vault_points_ledger WHERE user_id=? AND kind='gift' AND ref_type='welcome'").bind(user.id).all();
    const done = new Set((have.results || []).map((r) => r.ref_id));
    const wanted = [];
    if (!done.has("email") && S.gift_email_points > 0) wanted.push({ k: "email", pts: S.gift_email_points, label: "Welcome gift: verified email" });
    if (!done.has("wallet") && S.gift_wallet_points > 0) {
      const w = await e.DB.prepare("SELECT 1 AS x FROM wallets WHERE user_id=? AND verified=1 LIMIT 1").bind(user.id).first();
      if (w) wanted.push({ k: "wallet", pts: S.gift_wallet_points, label: "Welcome gift: verified wallet" });
    }
    const granted = [];
    for (const g of wanted) {
      const now = nowIso();
      const exp = addMonths(new Date(), S.points_expiry_months).toISOString();
      const r = await e.DB.prepare(
        "INSERT OR IGNORE INTO vault_points_ledger(id,user_id,kind,amount,remaining,expires_at,ref_type,ref_id,note,created_at) VALUES(?,?,'gift',?,?,?,'welcome',?,?,?)"
      ).bind(id(), user.id, g.pts, g.pts, exp, g.k, g.label, now).run();
      if (r?.meta?.changes === 1) {
        granted.push({ kind: g.k, points: g.pts });
        await e.DB.prepare("INSERT INTO notifications(id,user_id,type,title,message,created_at) VALUES(?,?,?,?,?,?)")
          .bind(id(), user.id, "vault_gift", "Design Vault gift", `${g.pts} points were added to your Design Vault balance (${g.label.replace("Welcome gift: ", "")}).`, now).run().catch(() => {});
      }
    }
    return granted;
  }

  // ------------------------------------------------------------------ image rows

  function publicImage(r, styleMap, unlockedSet, S) {
    return {
      id: r.id,
      title: r.title,
      category: r.category,
      hasStones: !!r.has_stones,
      free: !!r.is_free,
      styles: (styleMap.get(r.id) || []),
      unlocked: unlockedSet ? unlockedSet.has(r.id) : false,
      cost: r.is_free ? 0 : S.unlock_cost_points,
      previewUrl: `/api/vault/img/${r.id}/preview`,
      publishedAt: r.published_at
    };
  }

  async function stylesFor(e, ids) {
    const map = new Map();
    if (!ids.length) return map;
    const r = await e.DB.prepare(
      `SELECT s.image_id, s.style_slug AS slug, st.name FROM vault_image_styles s JOIN vault_styles st ON st.slug=s.style_slug WHERE s.image_id IN (${ids.map(() => "?").join(",")}) ORDER BY st.sort_order`
    ).bind(...ids).all();
    for (const x of r.results || []) {
      if (!map.has(x.image_id)) map.set(x.image_id, []);
      map.get(x.image_id).push({ slug: x.slug, name: x.name });
    }
    return map;
  }

  async function unlockedAmong(e, userId, ids) {
    const set = new Set();
    if (!userId || !ids.length) return set;
    const r = await e.DB.prepare(
      `SELECT DISTINCT image_id FROM vault_unlocks WHERE user_id=? AND expires_at>? AND image_id IN (${ids.map(() => "?").join(",")})`
    ).bind(userId, nowIso(), ...ids).all();
    for (const x of r.results || []) set.add(x.image_id);
    return set;
  }

  async function activeUnlock(e, userId, imageId) {
    return e.DB.prepare("SELECT id,expires_at,seq FROM vault_unlocks WHERE user_id=? AND image_id=? AND expires_at>? ORDER BY expires_at DESC LIMIT 1")
      .bind(userId, imageId, nowIso()).first();
  }

  // ------------------------------------------------------------------ public endpoints

  async function status(e, req) {
    const S = await getSettings(e);
    return out({ ok: true, launched: S.launched === 1 }, 200, 30, cors(e));
  }

  async function meta(e, req) {
    const g = await gate(e, req);
    if (!g.open) return J(e, { ok: true, launched: false });
    const cats = await e.DB.prepare("SELECT slug,name FROM vault_categories WHERE active=1 ORDER BY sort_order").all();
    const styles = await e.DB.prepare("SELECT slug,name FROM vault_styles WHERE active=1 ORDER BY sort_order").all();
    return J(e, {
      ok: true,
      launched: g.settings.launched === 1,
      adminPreview: g.settings.launched !== 1 && g.isAdmin,
      categories: cats.results || [],
      styles: styles.results || [],
      unlockCost: g.settings.unlock_cost_points,
      unlockDays: g.settings.unlock_days
    });
  }

  async function me(e, req) {
    const g = await gate(e, req);
    const base = { ok: true, launched: g.settings.launched === 1, loggedIn: !!g.user, isAdmin: g.isAdmin };
    if (!g.user) return J(e, base);
    if (!g.open) return J(e, base);
    const newGifts = await ensureGifts(e, g.user, g.settings);
    const summary = await pointsSummary(e, g.user.id);
    const un = await e.DB.prepare("SELECT DISTINCT image_id FROM vault_unlocks WHERE user_id=? AND expires_at>? LIMIT 5000").bind(g.user.id, nowIso()).all();
    return J(e, { ...base, points: { balance: summary.balance, nextExpiry: summary.nextExpiry }, creditCents: summary.creditCents, unlockedIds: (un.results || []).map((r) => r.image_id), newGifts });
  }

  async function gallery(e, req, u) {
    const g = await gate(e, req);
    if (!g.open) return J(e, { ok: false, error: "not_launched" }, 404);
    const q = u.searchParams;
    // "My unlocked" also lists images the admin has since hidden: the user paid for them.
    const mine = q.get("unlocked") === "1";
    const where = [mine ? "i.status!='deleted'" : "i.status='published'"];
    const args = [];
    const cat = q.get("category") || "";
    if (cat) {
      if (!SLUG_RE.test(cat)) return J(e, { ok: false, error: "invalid_filter" }, 400);
      where.push("i.category=?"); args.push(cat);
    }
    const style = q.get("style") || "";
    if (style) {
      if (!SLUG_RE.test(style)) return J(e, { ok: false, error: "invalid_filter" }, 400);
      where.push("EXISTS(SELECT 1 FROM vault_image_styles s WHERE s.image_id=i.id AND s.style_slug=?)"); args.push(style);
    }
    if (q.get("free") === "1") where.push("i.is_free=1");
    if (mine) {
      if (!g.user) return J(e, { ok: false, error: "unauthorized" }, 401);
      where.push("i.id IN (SELECT image_id FROM vault_unlocks WHERE user_id=? AND expires_at>?)");
      args.push(g.user.id, nowIso());
    }
    const text = cleanText(q.get("q"), 60);
    if (text) { where.push("i.title LIKE ? ESCAPE '\\'"); args.push(`%${likeEscape(text)}%`); }
    const page = intIn(q.get("page"), 1, 1, 10000);
    const W = where.join(" AND ");
    const total = await e.DB.prepare(`SELECT COUNT(*) AS c FROM vault_images i WHERE ${W}`).bind(...args).first();
    const rows = await e.DB.prepare(
      `SELECT i.id,i.title,i.category,i.has_stones,i.is_free,i.published_at FROM vault_images i WHERE ${W} ORDER BY i.published_at DESC, i.id DESC LIMIT ? OFFSET ?`
    ).bind(...args, LIMITS.pageSize, (page - 1) * LIMITS.pageSize).all();
    const list = rows.results || [];
    const ids = list.map((r) => r.id);
    const [styleMap, unlocked] = await Promise.all([stylesFor(e, ids), unlockedAmong(e, g.user?.id, ids)]);
    return J(e, {
      ok: true,
      page,
      pageSize: LIMITS.pageSize,
      total: Number(total?.c || 0),
      items: list.map((r) => publicImage(r, styleMap, unlocked, g.settings))
    });
  }

  async function imageDetail(e, req, imageId) {
    const g = await gate(e, req);
    if (!g.open) return J(e, { ok: false, error: "not_launched" }, 404);
    const r = await e.DB.prepare("SELECT i.*, c.name AS category_name FROM vault_images i LEFT JOIN vault_categories c ON c.slug=i.category WHERE i.id=?").bind(imageId).first();
    if (!r) return notFound(e);
    const unlock = g.user ? await activeUnlock(e, g.user.id, imageId) : null;
    if (r.status !== "published" && !g.isAdmin && !unlock) return notFound(e);
    const styleMap = await stylesFor(e, [imageId]);
    const item = publicImage(r, styleMap, new Set(unlock ? [imageId] : []), g.settings);
    return J(e, {
      ok: true,
      item: {
        ...item,
        categoryName: r.category_name || r.category,
        status: g.isAdmin ? r.status : undefined,
        demoUrl: r.is_free || unlock ? `/api/vault/img/${imageId}/demo` : null,
        unlockExpiresAt: unlock ? unlock.expires_at : null
      },
      unlockDays: g.settings.unlock_days
    });
  }

  // Watermarked previews are public marketing assets; a clean demo is served only for free images
  // or to a user holding an active unlock. The untouched original never goes through this route.
  async function serveImage(e, req, imageId, kind) {
    if (!e.VAULT) return J(e, { ok: false, error: "storage_not_configured" }, 503);
    const g = await gate(e, req);
    if (!g.open) return notFound(e);
    const r = await e.DB.prepare("SELECT id,is_free,status,preview_key,demo_key FROM vault_images WHERE id=?").bind(imageId).first();
    if (!r) return notFound(e);
    let unlock = null;
    if (g.user && !r.is_free) unlock = await activeUnlock(e, g.user.id, imageId);
    if (r.status !== "published" && !g.isAdmin && !unlock) return notFound(e);
    let key, cache, corp = "cross-origin";
    const launched = g.settings.launched === 1;
    if (kind === "preview") {
      key = r.preview_key;
      cache = launched && r.status === "published" ? "public, max-age=86400" : "private, no-store";
    } else if (kind === "demo") {
      if (r.is_free) {
        key = r.demo_key;
        cache = launched && r.status === "published" ? "public, max-age=3600" : "private, no-store";
      } else if (unlock || g.isAdmin) {
        // Clean 1600px copy of a paid image: only for its owner, never embeddable elsewhere.
        key = r.demo_key;
        cache = "private, no-store";
        corp = "same-origin";
      } else return notFound(e);
    } else return notFound(e);
    const obj = await e.VAULT.get(key);
    if (!obj) return notFound(e);
    const headers = {
      "content-type": obj.httpMetadata?.contentType || "image/jpeg",
      "cache-control": cache,
      "x-content-type-options": "nosniff",
      // Watermarked previews and free demos are meant to be shared, so they stay embeddable.
      "cross-origin-resource-policy": corp,
      "content-security-policy": "default-src 'none'; sandbox"
    };
    if (obj.size != null) headers["content-length"] = String(obj.size);
    return new Response(req.method === "HEAD" ? null : obj.body, { status: 200, headers });
  }

  async function unlock(e, req) {
    const g = await gate(e, req);
    if (!g.user) return J(e, { ok: false, error: "unauthorized" }, 401);
    if (!await requireOrigin(e, req)) return J(e, { ok: false, error: "forbidden" }, 403);
    if (!g.open) return J(e, { ok: false, error: "not_launched" }, 404);
    if (!await rateLimit(e, `vunlock:${g.user.id}`, 30, 6e4)) return J(e, { ok: false, error: "rate_limited" }, 429);
    const d = await req.json().catch(() => ({}));
    const imageId = String(d.imageId || "");
    if (!ID_RE.test(imageId)) return J(e, { ok: false, error: "invalid_image" }, 400);
    const img = await e.DB.prepare("SELECT id,is_free,status FROM vault_images WHERE id=?").bind(imageId).first();
    if (!img || img.status !== "published") return notFound(e);
    if (img.is_free) return J(e, { ok: false, error: "free_image", message: "This image is free to view and has no download." }, 400);
    const cost = g.settings.unlock_cost_points;
    for (let attempt = 0; attempt < 3; attempt++) {
      const existing = await activeUnlock(e, g.user.id, imageId);
      if (existing) {
        const s = await pointsSummary(e, g.user.id);
        return J(e, { ok: true, already: true, expiresAt: existing.expires_at, balance: s.balance });
      }
      const now = nowIso();
      const lots = await validLots(e, g.user.id, now);
      const plan = planSpend(lots, cost);
      if (!plan) {
        const s = await pointsSummary(e, g.user.id);
        return J(e, { ok: false, error: "insufficient_points", balance: s.balance, cost }, 402);
      }
      const seqRow = await e.DB.prepare("SELECT COALESCE(MAX(seq),-1)+1 AS n FROM vault_unlocks WHERE user_id=? AND image_id=?").bind(g.user.id, imageId).first();
      const expires = new Date(Date.now() + g.settings.unlock_days * 864e5).toISOString();
      const stmts = [
        // UNIQUE(user_id,image_id,seq) makes two simultaneous clicks collide, which rolls the whole batch back.
        e.DB.prepare("INSERT INTO vault_unlocks(id,user_id,image_id,seq,points_spent,unlocked_at,expires_at) VALUES(?,?,?,?,?,?,?)")
          .bind(id(), g.user.id, imageId, Number(seqRow.n), cost, now, expires),
        // CHECK(remaining>=0) makes a concurrent spend of the same lot fail instead of going negative.
        ...plan.map((p) => e.DB.prepare("UPDATE vault_points_ledger SET remaining=remaining-? WHERE id=? AND user_id=?").bind(p.take, p.id, g.user.id)),
        e.DB.prepare("INSERT INTO vault_points_ledger(id,user_id,kind,amount,remaining,ref_type,ref_id,note,created_at) VALUES(?,?,'spend',?,0,'unlock',?,?,?)")
          .bind(id(), g.user.id, -cost, imageId, "Unlocked image", now)
      ];
      try {
        await e.DB.batch(stmts);
      } catch (err) {
        const msg = String(err?.message || err);
        if (/UNIQUE|CHECK|constraint/i.test(msg)) continue; // lost a race: re-read and decide again
        throw err;
      }
      const s = await pointsSummary(e, g.user.id);
      return J(e, { ok: true, already: false, expiresAt: expires, balance: s.balance, spent: cost });
    }
    return J(e, { ok: false, error: "busy", message: "Please try again." }, 409);
  }

  // Short-lived link, signed with HMAC and bound to the user AND to the browser session that asked.
  async function sessionHash(req) {
    const m = (req.headers.get("Cookie") || "").match(/(?:^|;\s*)GDTY_SESSION=([^;]+)/);
    return m ? sha256Text(m[1]) : "";
  }

  function linkSecret(e) {
    const s = String(e.VAULT_LINK_SECRET || "");
    return s.length >= 32 ? s : null;
  }

  async function downloadLink(e, req) {
    const g = await gate(e, req);
    if (!g.user) return J(e, { ok: false, error: "unauthorized" }, 401);
    if (!await requireOrigin(e, req)) return J(e, { ok: false, error: "forbidden" }, 403);
    if (!g.open) return J(e, { ok: false, error: "not_launched" }, 404);
    const secret = linkSecret(e);
    if (!secret || !e.VAULT) {
      console.error("GOLDITY vault: VAULT_LINK_SECRET (32+ chars) or the VAULT R2 binding is missing");
      return J(e, { ok: false, error: "downloads_unavailable", message: "Downloads are temporarily unavailable." }, 503);
    }
    if (!await rateLimit(e, `vdl:${g.user.id}`, LIMITS.downloadsPerHour, 36e5)) return J(e, { ok: false, error: "rate_limited" }, 429);
    const d = await req.json().catch(() => ({}));
    const imageId = String(d.imageId || "");
    if (!ID_RE.test(imageId)) return J(e, { ok: false, error: "invalid_image" }, 400);
    const img = await e.DB.prepare("SELECT id,is_free FROM vault_images WHERE id=?").bind(imageId).first();
    if (!img || img.is_free) return notFound(e);
    const un = await activeUnlock(e, g.user.id, imageId);
    if (!un) return J(e, { ok: false, error: "not_unlocked" }, 403);
    const sess = await sessionHash(req);
    if (!sess) return J(e, { ok: false, error: "unauthorized" }, 401);
    const exp = Math.floor(Date.now() / 1000) + LIMITS.downloadLinkTtlSec;
    const sig = await hmacHex(secret, `dl|${imageId}|${g.user.id}|${sess}|${exp}`);
    return J(e, { ok: true, url: `/api/vault/file/${imageId}?exp=${exp}&sig=${sig}`, expiresInSeconds: LIMITS.downloadLinkTtlSec });
  }

  async function downloadFile(e, req, u, imageId) {
    const deny = (status = 403) => new Response("Forbidden", { status, headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" } });
    const secret = linkSecret(e);
    if (!secret || !e.VAULT) return deny(503);
    const site = req.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none") return deny();
    const user = await currentUser(e, req);
    if (!user) return deny(401);
    const exp = Number(u.searchParams.get("exp"));
    const sig = String(u.searchParams.get("sig") || "");
    const nowSec = Math.floor(Date.now() / 1000);
    if (!Number.isInteger(exp) || exp < nowSec || exp > nowSec + LIMITS.downloadLinkTtlSec + 30 || !/^[a-f0-9]{64}$/.test(sig)) return deny();
    const sess = await sessionHash(req);
    const expect = await hmacHex(secret, `dl|${imageId}|${user.id}|${sess}|${exp}`);
    if (!sess || !safeEq(expect, sig)) return deny();
    // Re-check the unlock now: the link is only valid while the user still holds access.
    const un = await activeUnlock(e, user.id, imageId);
    if (!un) return deny();
    const img = await e.DB.prepare("SELECT id,original_key,original_type FROM vault_images WHERE id=?").bind(imageId).first();
    if (!img) return new Response("Not found", { status: 404 });
    const obj = await e.VAULT.get(img.original_key);
    if (!obj) {
      console.error("GOLDITY vault: original missing in R2", imageId);
      return new Response("Not found", { status: 404 });
    }
    const ipHash = await hashIp(e, ipBucket(ip(req)));
    await e.DB.prepare("INSERT INTO vault_downloads(id,user_id,image_id,downloaded_at,ip_hash) VALUES(?,?,?,?,?)").bind(id(), user.id, imageId, nowIso(), ipHash).run().catch((err) => console.error("GOLDITY vault download log failed", err));
    const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[img.original_type] || "bin";
    const headers = {
      "content-type": img.original_type,
      "content-disposition": `attachment; filename="goldity-${imageId}.${ext}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      // The full-quality file must never be embeddable on another site.
      "cross-origin-resource-policy": "same-origin",
      "content-security-policy": "default-src 'none'; sandbox"
    };
    if (obj.size != null) headers["content-length"] = String(obj.size);
    return new Response(obj.body, { status: 200, headers });
  }

  // ------------------------------------------------------------------ SEO page /vault/<id>

  async function fetchAsset(e, req, path) {
    let target = new URL(path, req.url);
    for (let i = 0; i < 3; i++) {
      const r = await e.ASSETS.fetch(new Request(target.toString(), { method: "GET", headers: { accept: "text/html" } }));
      if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
        target = new URL(r.headers.get("location"), target);
        continue;
      }
      return r;
    }
    return null;
  }

  async function seoPage(e, req, u) {
    const m = u.pathname.match(/^\/vault\/([a-z0-9]{10})\/?$/);
    const miss = () => new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex" } });
    if (!m || !e.ASSETS) return miss();
    const imageId = m[1];
    let g;
    try { g = await gate(e, req); } catch { return miss(); }
    if (!g.open) return miss();
    const r = await e.DB.prepare("SELECT id,title,description,category,is_free,status FROM vault_images WHERE id=?").bind(imageId).first();
    if (!r) return miss();
    if (r.status !== "published" && !g.isAdmin) return miss();
    const shell = await fetchAsset(e, req, "/vault.html");
    if (!shell || !shell.ok) return miss();
    let html = await shell.text();
    const origin = String(e.PUBLIC_ORIGIN || "https://goldityglobal.com").replace(/\/$/, "");
    const cat = await e.DB.prepare("SELECT name FROM vault_categories WHERE slug=?").bind(r.category).first();
    const catName = cat?.name || r.category;
    const title = `${r.title} | GOLDITY Design Vault`;
    const desc = cleanText(r.description, 200) || `${catName} jewelry design concept from the GOLDITY Design Vault. Unlock the full-resolution file with points, or order a CAD file based on this design.`;
    const ogImage = `${origin}/api/vault/img/${imageId}/${r.is_free ? "demo" : "preview"}`;
    const canon = `${origin}/vault/${imageId}`;
    const ld = JSON.stringify({ "@context": "https://schema.org", "@type": "ImageObject", name: r.title, description: desc, contentUrl: ogImage, url: canon }).replace(/</g, "\\u003c");
    const tags = [
      `<meta name="description" content="${htmlEscape(desc)}">`,
      `<link rel="canonical" href="${htmlEscape(canon)}">`,
      `<meta property="og:site_name" content="GOLDITY">`,
      `<meta property="og:type" content="website">`,
      `<meta property="og:title" content="${htmlEscape(title)}">`,
      `<meta property="og:description" content="${htmlEscape(desc)}">`,
      `<meta property="og:url" content="${htmlEscape(canon)}">`,
      `<meta property="og:image" content="${htmlEscape(ogImage)}">`,
      `<meta name="twitter:card" content="summary_large_image">`,
      `<meta name="twitter:title" content="${htmlEscape(title)}">`,
      `<meta name="twitter:description" content="${htmlEscape(desc)}">`,
      `<meta name="twitter:image" content="${htmlEscape(ogImage)}">`,
      `<script type="application/ld+json">${ld}</script>`
    ].join("\n");
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${htmlEscape(title)}</title>`);
    html = html.replace(/<meta name="description"[^>]*>\s*/i, "");
    html = html.replace(/<link rel="canonical"[^>]*>\s*/i, "");
    html = html.includes("<!--VAULT_META-->") ? html.replace("<!--VAULT_META-->", tags) : html.replace("</head>", `${tags}\n</head>`);
    return new Response(req.method === "HEAD" ? null : html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-cache",
        "x-content-type-options": "nosniff",
        "referrer-policy": "strict-origin-when-cross-origin",
        ...(r.status !== "published" || g.settings.launched !== 1 ? { "x-robots-tag": "noindex" } : {})
      }
    });
  }

  // ------------------------------------------------------------------ admin endpoints

  async function adminSetup(e, req) {
    const a = await requireAdmin(e, req, { write: true });
    if (a.err) return a.err;
    for (let i = 0; i < VAULT_SCHEMA.length; i += 10) {
      await e.DB.batch(VAULT_SCHEMA.slice(i, i + 10).map((s) => e.DB.prepare(s)));
    }
    const L = await logStmt(e, req, a.user, "setup", "schema", "010", undefined, { statements: VAULT_SCHEMA.length }, null);
    await L.run();
    return J(e, { ok: true, statements: VAULT_SCHEMA.length });
  }

  async function adminOverview(e, req) {
    const a = await requireAdmin(e, req, { write: false });
    if (a.err) return a.err;
    const S = await getSettings(e);
    const cats = await e.DB.prepare("SELECT * FROM vault_categories ORDER BY sort_order").all();
    const styles = await e.DB.prepare("SELECT * FROM vault_styles ORDER BY sort_order, name").all();
    const counts = await e.DB.prepare("SELECT status, COUNT(*) AS c FROM vault_images GROUP BY status").all();
    const free = await e.DB.prepare("SELECT category, COUNT(*) AS c FROM vault_images WHERE is_free=1 AND status!='deleted' GROUP BY category").all();
    return J(e, {
      ok: true,
      settings: S,
      settingDefs: Object.fromEntries(Object.entries(SETTING_DEFS).map(([k, d]) => [k, { min: d.min, max: d.max, def: d.def, label: d.label }])),
      categories: cats.results || [],
      styles: styles.results || [],
      imageCounts: Object.fromEntries((counts.results || []).map((r) => [r.status, r.c])),
      freeCounts: Object.fromEntries((free.results || []).map((r) => [r.category, r.c])),
      config: {
        r2Bound: !!e.VAULT,
        linkSecretOk: !!linkSecret(e),
        treasuryConfigured: !!e.VAULT_TREASURY_ADDRESS
      }
    });
  }

  async function adminSettings(e, req) {
    const a = await requireAdmin(e, req, { write: true });
    if (a.err) return a.err;
    const d = await req.json().catch(() => ({}));
    const incoming = d.settings && typeof d.settings === "object" ? d.settings : {};
    const current = await getSettings(e);
    const changes = [];
    for (const [k, v] of Object.entries(incoming)) {
      const def = SETTING_DEFS[k];
      if (!def) return J(e, { ok: false, error: "unknown_setting", key: k }, 400);
      const n = Number(v);
      if (!Number.isInteger(n) || n < def.min || n > def.max) return J(e, { ok: false, error: "out_of_range", key: k, min: def.min, max: def.max }, 400);
      if (n !== current[k]) changes.push([k, n]);
    }
    if (!changes.length) return J(e, { ok: true, settings: current, changed: [] });
    if (changes.some(([k, n]) => k === "launched" && n === 1)) {
      const problems = [];
      if (!e.VAULT) problems.push("R2 binding VAULT is missing");
      if (!linkSecret(e)) problems.push("Worker secret VAULT_LINK_SECRET (32+ characters) is missing");
      if (problems.length) return J(e, { ok: false, error: "not_configured", problems }, 400);
    }
    const now = nowIso();
    const stmts = [];
    for (const [k, n] of changes) {
      stmts.push(e.DB.prepare("INSERT INTO vault_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(k, String(n), now));
      stmts.push(await logStmt(e, req, a.user, "setting", "setting", k, current[k], n, null));
    }
    stmts.push(await auditStmt(e, req, a.user, "settings"));
    await e.DB.batch(stmts);
    return J(e, { ok: true, settings: await getSettings(e), changed: changes.map(([k]) => k) });
  }

  async function adminCategoryUpdate(e, req) {
    const a = await requireAdmin(e, req, { write: true });
    if (a.err) return a.err;
    const d = await req.json().catch(() => ({}));
    const slug = String(d.slug || "");
    const cur = SLUG_RE.test(slug) ? await e.DB.prepare("SELECT * FROM vault_categories WHERE slug=?").bind(slug).first() : null;
    if (!cur) return notFound(e);
    const next = { ...cur };
    if (d.name !== undefined) {
      next.name = cleanText(d.name, 60);
      if (!next.name) return J(e, { ok: false, error: "invalid_name" }, 400);
    }
    if (d.active !== undefined) next.active = d.active ? 1 : 0;
    if (d.freeLimit !== undefined) {
      if (d.freeLimit === null || d.freeLimit === "") next.free_limit = null;
      else {
        const n = Number(d.freeLimit);
        if (!Number.isInteger(n) || n < 0 || n > 200) return J(e, { ok: false, error: "invalid_free_limit" }, 400);
        next.free_limit = n;
      }
    }
    for (const [field, col] of [["cadStonesCents", "cad_stones_cents"], ["cadPlainCents", "cad_plain_cents"], ["cadCustomCents", "cad_custom_cents"]]) {
      if (d[field] !== undefined) {
        const n = Number(d[field]);
        if (!Number.isInteger(n) || n < 0 || n > 1000000) return J(e, { ok: false, error: "invalid_price", field }, 400);
        next[col] = n;
      }
    }
    const pick = (r) => ({ name: r.name, active: r.active, free_limit: r.free_limit, cad_stones_cents: r.cad_stones_cents, cad_plain_cents: r.cad_plain_cents, cad_custom_cents: r.cad_custom_cents });
    if (JSON.stringify(pick(cur)) === JSON.stringify(pick(next))) return J(e, { ok: true, unchanged: true });
    await e.DB.batch([
      e.DB.prepare("UPDATE vault_categories SET name=?,active=?,free_limit=?,cad_stones_cents=?,cad_plain_cents=?,cad_custom_cents=? WHERE slug=?")
        .bind(next.name, next.active, next.free_limit, next.cad_stones_cents, next.cad_plain_cents, next.cad_custom_cents, slug),
      await logStmt(e, req, a.user, "category", "category", slug, pick(cur), pick(next), null),
      await auditStmt(e, req, a.user, "category")
    ]);
    return J(e, { ok: true });
  }

  async function adminStyles(e, req) {
    const a = await requireAdmin(e, req, { write: true });
    if (a.err) return a.err;
    const d = await req.json().catch(() => ({}));
    if (d.op === "add") {
      const name = cleanText(d.name, 40);
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
      if (!name || !SLUG_RE.test(slug)) return J(e, { ok: false, error: "invalid_name", message: "Use letters and numbers." }, 400);
      const cnt = await e.DB.prepare("SELECT COUNT(*) AS c FROM vault_styles").first();
      if (Number(cnt.c) >= 40) return J(e, { ok: false, error: "too_many_styles" }, 400);
      const mx = await e.DB.prepare("SELECT COALESCE(MAX(sort_order),0)+10 AS n FROM vault_styles").first();
      const r = await e.DB.prepare("INSERT OR IGNORE INTO vault_styles(slug,name,sort_order,active) VALUES(?,?,?,1)").bind(slug, name, Number(mx.n)).run();
      if (!r?.meta?.changes) return J(e, { ok: false, error: "style_exists" }, 409);
      await (await logStmt(e, req, a.user, "style_add", "style", slug, undefined, { name }, null)).run();
      return J(e, { ok: true, slug });
    }
    if (d.op === "update") {
      const slug = String(d.slug || "");
      const cur = SLUG_RE.test(slug) ? await e.DB.prepare("SELECT * FROM vault_styles WHERE slug=?").bind(slug).first() : null;
      if (!cur) return notFound(e);
      const name = d.name === undefined ? cur.name : cleanText(d.name, 40);
      if (!name) return J(e, { ok: false, error: "invalid_name" }, 400);
      const active = d.active === undefined ? cur.active : d.active ? 1 : 0;
      await e.DB.batch([
        e.DB.prepare("UPDATE vault_styles SET name=?,active=? WHERE slug=?").bind(name, active, slug),
        await logStmt(e, req, a.user, "style_update", "style", slug, { name: cur.name, active: cur.active }, { name, active }, null)
      ]);
      return J(e, { ok: true });
    }
    return J(e, { ok: false, error: "invalid_op" }, 400);
  }

  async function freeLimitFor(e, category) {
    const c = await e.DB.prepare("SELECT free_limit FROM vault_categories WHERE slug=?").bind(category).first();
    const S = await getSettings(e);
    return c && c.free_limit !== null && c.free_limit !== undefined ? Number(c.free_limit) : S.free_per_category;
  }

  async function adminUpload(e, req) {
    const a = await requireAdmin(e, req, { write: true });
    if (a.err) return a.err;
    if (!e.VAULT) return J(e, { ok: false, error: "storage_not_configured", message: "The R2 bucket binding VAULT is missing." }, 503);
    const len = Number(req.headers.get("content-length") || 0);
    if (len > LIMITS.requestBytes) return J(e, { ok: false, error: "too_large" }, 413);
    let form;
    try { form = await req.formData(); } catch { return J(e, { ok: false, error: "invalid_form" }, 400); }
    if (String(form.get("brandCheck")) !== "1") return J(e, { ok: false, error: "brand_check_required", message: "Confirm the design does not resemble a known brand's design." }, 400);
    const title = cleanText(form.get("title"), 120);
    const description = cleanText(form.get("description"), 400);
    const category = String(form.get("category") || "");
    const hasStones = String(form.get("hasStones")) === "1" ? 1 : 0;
    const wantFree = String(form.get("free")) === "1" ? 1 : 0;
    const styleSlugs = [...new Set(String(form.get("styles") || "").split(",").map((s) => s.trim()).filter(Boolean))];
    if (!title) return J(e, { ok: false, error: "title_required" }, 400);
    const cat = SLUG_RE.test(category) ? await e.DB.prepare("SELECT slug FROM vault_categories WHERE slug=? AND active=1").bind(category).first() : null;
    if (!cat) return J(e, { ok: false, error: "invalid_category" }, 400);
    if (styleSlugs.length < 1 || styleSlugs.length > 2) return J(e, { ok: false, error: "styles_1_or_2" }, 400);
    for (const s of styleSlugs) {
      if (!SLUG_RE.test(s) || !await e.DB.prepare("SELECT 1 AS x FROM vault_styles WHERE slug=? AND active=1").bind(s).first()) return J(e, { ok: false, error: "invalid_style", style: s }, 400);
    }
    const files = {};
    for (const [field, max] of [["original", LIMITS.originalBytes], ["preview", LIMITS.previewBytes], ["demo", LIMITS.demoBytes]]) {
      const f = form.get(field);
      if (!f || typeof f === "string" || typeof f.arrayBuffer !== "function") return J(e, { ok: false, error: "file_missing", field }, 400);
      if (f.size > max) return J(e, { ok: false, error: "file_too_large", field, maxBytes: max }, 413);
      const bytes = new Uint8Array(await f.arrayBuffer());
      const info = sniffImage(bytes);
      if (!info) return J(e, { ok: false, error: "unsupported_image", field, message: "Only JPG, PNG and still WebP images are accepted." }, 400);
      files[field] = { bytes, info };
    }
    const { original, preview, demo } = files;
    if (Math.max(preview.info.width, preview.info.height) > LIMITS.previewMaxSide) return J(e, { ok: false, error: "preview_too_large", message: `The preview's long side must be ${LIMITS.previewMaxSide}px or less.` }, 400);
    if (Math.max(demo.info.width, demo.info.height) > LIMITS.demoMaxSide) return J(e, { ok: false, error: "demo_too_large", message: `The demo's long side must be ${LIMITS.demoMaxSide}px or less.` }, 400);
    const ar = (i) => i.width / i.height;
    for (const f of [preview, demo]) {
      if (Math.abs(ar(f.info) - ar(original.info)) / ar(original.info) > 0.03) return J(e, { ok: false, error: "aspect_mismatch", message: "The preview and demo must have the same proportions as the original." }, 400);
    }
    const [hO, hP, hD] = await Promise.all([sha256Bytes(original.bytes), sha256Bytes(preview.bytes), sha256Bytes(demo.bytes)]);
    if (hP === hO || hP === hD) return J(e, { ok: false, error: "preview_not_distinct", message: "The preview must not be the same file as the original or the demo." }, 400);

    const imageId = newImageId();
    const keys = { original: `orig/${imageId}`, preview: `prev/${imageId}`, demo: `demo/${imageId}` };
    try {
      await e.VAULT.put(keys.original, original.bytes, { httpMetadata: { contentType: original.info.mime } });
      await e.VAULT.put(keys.preview, preview.bytes, { httpMetadata: { contentType: preview.info.mime } });
      await e.VAULT.put(keys.demo, demo.bytes, { httpMetadata: { contentType: demo.info.mime } });
      const now = nowIso();
      const limit = await freeLimitFor(e, category);
      const stmts = [
        e.DB.prepare(
          `INSERT INTO vault_images(id,title,description,category,has_stones,is_free,status,original_key,preview_key,demo_key,original_type,original_bytes,width,height,uploaded_by,created_at,published_at,updated_at)
           VALUES(?,?,?,?,?, CASE WHEN ?=1 AND (SELECT COUNT(*) FROM vault_images WHERE category=? AND is_free=1 AND status!='deleted') < ? THEN 1 ELSE 0 END, 'published',?,?,?,?,?,?,?,?,?,?,?)`
        ).bind(imageId, title, description, category, hasStones, wantFree, category, limit,
          keys.original, keys.preview, keys.demo, original.info.mime, original.bytes.length, original.info.width, original.info.height, a.user.id, now, now, now),
        ...styleSlugs.map((s) => e.DB.prepare("INSERT INTO vault_image_styles(image_id,style_slug) VALUES(?,?)").bind(imageId, s)),
        await logStmt(e, req, a.user, "image_upload", "image", imageId, undefined, { title, category, hasStones, free: wantFree, styles: styleSlugs }, null),
        await auditStmt(e, req, a.user, "image_upload")
      ];
      await e.DB.batch(stmts);
    } catch (err) {
      for (const k of Object.values(keys)) await e.VAULT.delete(k).catch(() => {});
      throw err;
    }
    const row = await e.DB.prepare("SELECT is_free FROM vault_images WHERE id=?").bind(imageId).first();
    const free = !!row?.is_free;
    return J(e, { ok: true, id: imageId, free, freeLimitReached: wantFree === 1 && !free }, 201);
  }

  async function adminImages(e, req, u) {
    const a = await requireAdmin(e, req, { write: false });
    if (a.err) return a.err;
    const q = u.searchParams;
    const where = ["1=1"];
    const args = [];
    const st = q.get("status");
    if (st) {
      if (!["published", "hidden", "deleted"].includes(st)) return J(e, { ok: false, error: "invalid_filter" }, 400);
      where.push("i.status=?"); args.push(st);
    } else where.push("i.status!='deleted'");
    const cat = q.get("category") || "";
    if (cat) { if (!SLUG_RE.test(cat)) return J(e, { ok: false, error: "invalid_filter" }, 400); where.push("i.category=?"); args.push(cat); }
    const text = cleanText(q.get("q"), 60);
    if (text) { where.push("i.title LIKE ? ESCAPE '\\'"); args.push(`%${likeEscape(text)}%`); }
    const page = intIn(q.get("page"), 1, 1, 10000);
    const W = where.join(" AND ");
    const total = await e.DB.prepare(`SELECT COUNT(*) AS c FROM vault_images i WHERE ${W}`).bind(...args).first();
    const rows = await e.DB.prepare(
      `SELECT i.id,i.title,i.description,i.category,i.has_stones,i.is_free,i.status,i.created_at,
              (SELECT COUNT(*) FROM vault_unlocks x WHERE x.image_id=i.id) AS unlocks
       FROM vault_images i WHERE ${W} ORDER BY i.created_at DESC, i.id DESC LIMIT ? OFFSET ?`
    ).bind(...args, 30, (page - 1) * 30).all();
    const list = rows.results || [];
    const styleMap = await stylesFor(e, list.map((r) => r.id));
    return J(e, {
      ok: true, page, pageSize: 30, total: Number(total?.c || 0),
      items: list.map((r) => ({
        id: r.id, title: r.title, description: r.description, category: r.category, hasStones: !!r.has_stones, free: !!r.is_free,
        status: r.status, createdAt: r.created_at, unlocks: Number(r.unlocks),
        styles: (styleMap.get(r.id) || []).map((s) => s.slug),
        previewUrl: `/api/vault/img/${r.id}/preview`
      }))
    });
  }

  async function adminImageUpdate(e, req) {
    const a = await requireAdmin(e, req, { write: true });
    if (a.err) return a.err;
    const d = await req.json().catch(() => ({}));
    const imageId = String(d.id || "");
    const cur = ID_RE.test(imageId) ? await e.DB.prepare("SELECT * FROM vault_images WHERE id=?").bind(imageId).first() : null;
    if (!cur) return notFound(e);
    const curStyles = ((await e.DB.prepare("SELECT style_slug FROM vault_image_styles WHERE image_id=?").bind(imageId).all()).results || []).map((r) => r.style_slug).sort();
    const next = {
      title: d.title === undefined ? cur.title : cleanText(d.title, 120),
      description: d.description === undefined ? cur.description : cleanText(d.description, 400),
      category: d.category === undefined ? cur.category : String(d.category),
      has_stones: d.hasStones === undefined ? cur.has_stones : d.hasStones ? 1 : 0,
      is_free: d.free === undefined ? cur.is_free : d.free ? 1 : 0,
      status: d.status === undefined ? cur.status : String(d.status)
    };
    if (!next.title) return J(e, { ok: false, error: "title_required" }, 400);
    if (!["published", "hidden", "deleted"].includes(next.status)) return J(e, { ok: false, error: "invalid_status" }, 400);
    if (next.category !== cur.category) {
      const c = SLUG_RE.test(next.category) ? await e.DB.prepare("SELECT slug FROM vault_categories WHERE slug=? AND active=1").bind(next.category).first() : null;
      if (!c) return J(e, { ok: false, error: "invalid_category" }, 400);
    }
    let nextStyles = curStyles;
    if (d.styles !== undefined) {
      nextStyles = [...new Set((Array.isArray(d.styles) ? d.styles : []).map(String))].sort();
      if (nextStyles.length < 1 || nextStyles.length > 2) return J(e, { ok: false, error: "styles_1_or_2" }, 400);
      for (const s of nextStyles) {
        // A style that is already on the image may stay even if it was deactivated later.
        const ok = SLUG_RE.test(s) && (curStyles.includes(s) || await e.DB.prepare("SELECT 1 AS x FROM vault_styles WHERE slug=? AND active=1").bind(s).first());
        if (!ok) return J(e, { ok: false, error: "invalid_style", style: s }, 400);
      }
    }
    // Free-image limit per category, enforced on the server (and again atomically inside the UPDATE).
    const limit = await freeLimitFor(e, next.category);
    if (next.is_free === 1 && (cur.is_free !== 1 || next.category !== cur.category || (cur.status === "deleted" && next.status !== "deleted"))) {
      const c = await e.DB.prepare("SELECT COUNT(*) AS c FROM vault_images WHERE category=? AND is_free=1 AND status!='deleted' AND id!=?").bind(next.category, imageId).first();
      if (Number(c.c) >= limit) return J(e, { ok: false, error: "free_limit_reached", limit, message: `This category already has ${limit} free images.` }, 409);
    }
    const oldV = { title: cur.title, description: cur.description, category: cur.category, hasStones: cur.has_stones, free: cur.is_free, status: cur.status, styles: curStyles };
    const newV = { title: next.title, description: next.description, category: next.category, hasStones: next.has_stones, free: next.is_free, status: next.status, styles: nextStyles };
    if (JSON.stringify(oldV) === JSON.stringify(newV)) return J(e, { ok: true, unchanged: true });
    const now = nowIso();
    const publishedAt = cur.published_at || (next.status === "published" ? now : null);
    // The limit is only re-checked when this edit could actually add a free image to a category
    // (turning Free on, moving a free image, restoring a deleted one). An unrelated edit such as
    // a new title never silently un-frees an image, even if the limit was lowered later.
    const needsGuard = next.is_free === 1 && (cur.is_free !== 1 || next.category !== cur.category || (cur.status === "deleted" && next.status !== "deleted"));
    const stmts = [
      e.DB.prepare(
        `UPDATE vault_images SET title=?,description=?,category=?,has_stones=?,status=?,published_at=?,updated_at=?,
           is_free = CASE
             WHEN ?=0 THEN 0
             WHEN ?=0 THEN 1
             WHEN (SELECT COUNT(*) FROM vault_images WHERE category=? AND is_free=1 AND status!='deleted' AND id!=?) < ? THEN 1
             ELSE 0 END
         WHERE id=?`
      ).bind(next.title, next.description, next.category, next.has_stones, next.status, publishedAt, now, next.is_free, needsGuard ? 1 : 0, next.category, imageId, limit, imageId)
    ];
    if (JSON.stringify(curStyles) !== JSON.stringify(nextStyles)) {
      stmts.push(e.DB.prepare("DELETE FROM vault_image_styles WHERE image_id=?").bind(imageId));
      for (const s of nextStyles) stmts.push(e.DB.prepare("INSERT INTO vault_image_styles(image_id,style_slug) VALUES(?,?)").bind(imageId, s));
    }
    stmts.push(await logStmt(e, req, a.user, "image_update", "image", imageId, oldV, newV, null));
    stmts.push(await auditStmt(e, req, a.user, "image_update"));
    await e.DB.batch(stmts);
    const after = await e.DB.prepare("SELECT is_free FROM vault_images WHERE id=?").bind(imageId).first();
    return J(e, { ok: true, free: !!after?.is_free, freeLimitReached: next.is_free === 1 && !after?.is_free });
  }

  async function findUserByEmail(e, email) {
    const em = cleanText(email, 160).toLowerCase();
    if (!em) return null;
    return e.DB.prepare("SELECT id,email,first_name,last_name,wallet_address,email_verified,created_at FROM users WHERE email=?").bind(em).first();
  }

  async function adminUser(e, req, u) {
    const a = await requireAdmin(e, req, { write: false });
    if (a.err) return a.err;
    const user = await findUserByEmail(e, u.searchParams.get("email"));
    if (!user) return notFound(e);
    const s = await pointsSummary(e, user.id);
    const points = await e.DB.prepare("SELECT kind,amount,remaining,expires_at,note,created_at FROM vault_points_ledger WHERE user_id=? ORDER BY created_at DESC, id DESC LIMIT 40").bind(user.id).all();
    const credit = await e.DB.prepare("SELECT kind,amount_cents,note,created_at FROM vault_credit_ledger WHERE user_id=? ORDER BY created_at DESC, id DESC LIMIT 40").bind(user.id).all();
    const unlocks = await e.DB.prepare("SELECT image_id,unlocked_at,expires_at,points_spent FROM vault_unlocks WHERE user_id=? ORDER BY unlocked_at DESC LIMIT 20").bind(user.id).all();
    return J(e, {
      ok: true,
      user: { id: user.id, email: user.email, name: `${user.first_name} ${user.last_name}`.trim(), wallet: user.wallet_address, createdAt: user.created_at },
      points: s.balance, nextExpiry: s.nextExpiry, creditCents: s.creditCents,
      pointsLedger: points.results || [], creditLedger: credit.results || [], unlocks: unlocks.results || []
    });
  }

  async function adminPoints(e, req) {
    const a = await requireAdmin(e, req, { write: true });
    if (a.err) return a.err;
    const d = await req.json().catch(() => ({}));
    const pts = Number(d.points);
    const note = cleanText(d.note, 200);
    if (!Number.isInteger(pts) || pts === 0 || Math.abs(pts) > 100000) return J(e, { ok: false, error: "invalid_points" }, 400);
    if (note.length < 3) return J(e, { ok: false, error: "note_required", message: "Write a short reason (3+ characters)." }, 400);
    const user = await findUserByEmail(e, d.email);
    if (!user) return notFound(e);
    const S = await getSettings(e);
    const now = nowIso();
    const before = (await pointsSummary(e, user.id)).balance;
    for (let attempt = 0; attempt < 3; attempt++) {
      let stmts;
      if (pts > 0) {
        const exp = addMonths(new Date(), S.points_expiry_months).toISOString();
        stmts = [e.DB.prepare("INSERT INTO vault_points_ledger(id,user_id,kind,amount,remaining,expires_at,ref_type,ref_id,note,created_by,created_at) VALUES(?,?,'admin_add',?,?,?,'admin',?,?,?,?)")
          .bind(id(), user.id, pts, pts, exp, a.user.id, note, a.user.id, now)];
      } else {
        const plan = planSpend(await validLots(e, user.id, now), -pts);
        if (!plan) return J(e, { ok: false, error: "insufficient_points", balance: before }, 400);
        stmts = [
          ...plan.map((p) => e.DB.prepare("UPDATE vault_points_ledger SET remaining=remaining-? WHERE id=? AND user_id=?").bind(p.take, p.id, user.id)),
          e.DB.prepare("INSERT INTO vault_points_ledger(id,user_id,kind,amount,remaining,ref_type,ref_id,note,created_by,created_at) VALUES(?,?,'admin_remove',?,0,'admin',?,?,?,?)")
            .bind(id(), user.id, pts, a.user.id, note, a.user.id, now)
        ];
      }
      stmts.push(await logStmt(e, req, a.user, "points_adjust", "user", user.id, { points: before }, { delta: pts }, note));
      stmts.push(await auditStmt(e, req, a.user, "points_adjust"));
      try {
        await e.DB.batch(stmts);
      } catch (err) {
        if (/CHECK|constraint/i.test(String(err?.message || err))) continue;
        throw err;
      }
      const after = (await pointsSummary(e, user.id)).balance;
      if (pts > 0) {
        await e.DB.prepare("INSERT INTO notifications(id,user_id,type,title,message,created_at) VALUES(?,?,?,?,?,?)")
          .bind(id(), user.id, "vault_points", "Design Vault points added", `${pts} points were added to your Design Vault balance.`, nowIso()).run().catch(() => {});
      }
      return J(e, { ok: true, balance: after });
    }
    return J(e, { ok: false, error: "busy" }, 409);
  }

  async function adminCredit(e, req) {
    const a = await requireAdmin(e, req, { write: true });
    if (a.err) return a.err;
    const d = await req.json().catch(() => ({}));
    const cents = Number(d.cents);
    const note = cleanText(d.note, 200);
    if (!Number.isInteger(cents) || cents === 0 || Math.abs(cents) > 1000000) return J(e, { ok: false, error: "invalid_amount" }, 400);
    if (note.length < 3) return J(e, { ok: false, error: "note_required", message: "Write a short reason (3+ characters)." }, 400);
    const user = await findUserByEmail(e, d.email);
    if (!user) return notFound(e);
    const now = nowIso();
    const before = Number((await e.DB.prepare("SELECT balance_cents FROM vault_credit_accounts WHERE user_id=?").bind(user.id).first())?.balance_cents || 0);
    try {
      await e.DB.batch([
        e.DB.prepare("INSERT OR IGNORE INTO vault_credit_accounts(user_id,balance_cents,updated_at) VALUES(?,0,?)").bind(user.id, now),
        // CHECK(balance_cents>=0) aborts the whole batch if a removal would overdraw the account.
        e.DB.prepare("UPDATE vault_credit_accounts SET balance_cents=balance_cents+?,updated_at=? WHERE user_id=?").bind(cents, now, user.id),
        e.DB.prepare("INSERT INTO vault_credit_ledger(id,user_id,kind,amount_cents,ref_type,ref_id,note,created_by,created_at) VALUES(?,?,?,?,'admin',?,?,?,?)")
          .bind(id(), user.id, cents > 0 ? "admin_add" : "admin_remove", cents, a.user.id, note, a.user.id, now),
        await logStmt(e, req, a.user, "credit_adjust", "user", user.id, { cents: before }, { delta: cents }, note),
        await auditStmt(e, req, a.user, "credit_adjust")
      ]);
    } catch (err) {
      if (/CHECK|constraint/i.test(String(err?.message || err))) return J(e, { ok: false, error: "insufficient_credit", balanceCents: before }, 400);
      throw err;
    }
    if (cents > 0) {
      await e.DB.prepare("INSERT INTO notifications(id,user_id,type,title,message,created_at) VALUES(?,?,?,?,?,?)")
        .bind(id(), user.id, "vault_credit", "Site credit added", `$${(cents / 100).toFixed(2)} of site credit was added to your account.`, nowIso()).run().catch(() => {});
    }
    return J(e, { ok: true, balanceCents: before + cents });
  }

  async function adminLog(e, req, u) {
    const a = await requireAdmin(e, req, { write: false });
    if (a.err) return a.err;
    const limit = intIn(u.searchParams.get("limit"), 50, 1, 200);
    const r = await e.DB.prepare(
      "SELECT l.id,l.action,l.target_type,l.target_id,l.old_value,l.new_value,l.note,l.created_at,u.email AS admin_email FROM vault_admin_log l LEFT JOIN users u ON u.id=l.admin_id ORDER BY l.created_at DESC, l.id DESC LIMIT ?"
    ).bind(limit).all();
    return J(e, { ok: true, items: r.results || [] });
  }

  // ------------------------------------------------------------------ router

  async function route(req, e, u) {
    const p = u.pathname, m = req.method;
    const GETLIKE = m === "GET" || m === "HEAD";
    if (p === "/api/vault/status" && GETLIKE) return status(e, req);
    if (p === "/api/vault/meta" && GETLIKE) return meta(e, req);
    if (p === "/api/vault/me" && m === "GET") return me(e, req);
    if (p === "/api/vault/gallery" && m === "GET") return gallery(e, req, u);
    let x;
    if ((x = p.match(/^\/api\/vault\/image\/([a-z0-9]{10})$/)) && m === "GET") return imageDetail(e, req, x[1]);
    if ((x = p.match(/^\/api\/vault\/img\/([a-z0-9]{10})\/(preview|demo)$/)) && GETLIKE) return serveImage(e, req, x[1], x[2]);
    if (p === "/api/vault/unlock" && m === "POST") return unlock(e, req);
    if (p === "/api/vault/download-link" && m === "POST") return downloadLink(e, req);
    if ((x = p.match(/^\/api\/vault\/file\/([a-z0-9]{10})$/)) && m === "GET") return downloadFile(e, req, u, x[1]);

    if (p === "/api/admin/vault/setup" && m === "POST") return adminSetup(e, req);
    if (p === "/api/admin/vault/overview" && m === "GET") return adminOverview(e, req);
    if (p === "/api/admin/vault/settings" && m === "POST") return adminSettings(e, req);
    if (p === "/api/admin/vault/categories" && m === "POST") return adminCategoryUpdate(e, req);
    if (p === "/api/admin/vault/styles" && m === "POST") return adminStyles(e, req);
    if (p === "/api/admin/vault/images" && m === "POST") return adminUpload(e, req);
    if (p === "/api/admin/vault/images" && m === "GET") return adminImages(e, req, u);
    if (p === "/api/admin/vault/images/update" && m === "POST") return adminImageUpdate(e, req);
    if (p === "/api/admin/vault/user" && m === "GET") return adminUser(e, req, u);
    if (p === "/api/admin/vault/points" && m === "POST") return adminPoints(e, req);
    if (p === "/api/admin/vault/credit" && m === "POST") return adminCredit(e, req);
    if (p === "/api/admin/vault/log" && m === "GET") return adminLog(e, req, u);
    return notFound(e);
  }

  // Entry point used by worker.js. Returns null for any path that is not a Vault path.
  async function handle(req, e, u) {
    const p = u.pathname;
    const isApi = p.startsWith("/api/vault/") || p.startsWith("/api/admin/vault/");
    const isPage = p.startsWith("/vault/");
    if (!isApi && !isPage) return null;
    if (!e.DB) return J(e, { ok: false, error: "vault_not_ready" }, 503);
    try {
      if (isPage) return await seoPage(e, req, u);
      return await route(req, e, u);
    } catch (err) {
      // Before the schema exists every query fails with "no such table": report "not ready" instead of a crash.
      if (/no such table/i.test(String(err?.message || err))) {
        if (isPage) return new Response("Not found", { status: 404 });
        return J(e, { ok: false, error: "vault_not_ready" }, 503);
      }
      throw err;
    }
  }

  // Cron: return expired points to the ledger as 'expire' rows. Safe to re-run at any time.
  async function scheduled(e) {
    if (!e.DB) return;
    const now = nowIso();
    let lots;
    try {
      lots = await e.DB.prepare("SELECT id FROM vault_points_ledger WHERE remaining>0 AND expires_at<=? LIMIT 200").bind(now).all();
    } catch (err) {
      if (/no such table/i.test(String(err?.message || err))) return;
      throw err;
    }
    for (const l of lots.results || []) {
      await e.DB.batch([
        e.DB.prepare(
          "INSERT INTO vault_points_ledger(id,user_id,kind,amount,remaining,ref_type,ref_id,note,created_at) SELECT ?,user_id,'expire',-remaining,0,'lot',id,'Points expired',? FROM vault_points_ledger WHERE id=? AND remaining>0 AND expires_at<=?"
        ).bind(id(), now, l.id, now),
        e.DB.prepare("UPDATE vault_points_ledger SET remaining=0 WHERE id=? AND remaining>0 AND expires_at<=?").bind(l.id, now)
      ]);
    }
  }

  return { handle, scheduled };
}
