-- GOLDITY Design Vault, phase 1: gallery, points ledger, site credit, unlocks, downloads, admin log.
-- Generated from VAULT_SCHEMA in vault-engine.js. Every statement is idempotent, so running it twice is harmless.
-- Easiest way to apply it: sign in as admin, open /vault-admin.html and press "Set up database".
-- (The D1 console only accepts ONE statement per run; the button runs them all in the right order.)

CREATE TABLE IF NOT EXISTS vault_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vault_categories (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  size_kind TEXT NOT NULL DEFAULT 'none',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  free_limit INTEGER,
  cad_stones_cents INTEGER NOT NULL DEFAULT 0,
  cad_plain_cents INTEGER NOT NULL DEFAULT 0,
  cad_custom_cents INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS vault_styles (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS vault_images (
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
);

CREATE INDEX IF NOT EXISTS idx_vault_images_list ON vault_images(status, category, published_at);

CREATE TABLE IF NOT EXISTS vault_image_styles (
  image_id TEXT NOT NULL,
  style_slug TEXT NOT NULL,
  PRIMARY KEY (image_id, style_slug)
);

CREATE INDEX IF NOT EXISTS idx_vault_image_styles_style ON vault_image_styles(style_slug);

CREATE TABLE IF NOT EXISTS vault_points_ledger (
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
);

CREATE INDEX IF NOT EXISTS idx_vault_points_user ON vault_points_ledger(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_vault_points_lots ON vault_points_ledger(user_id, expires_at) WHERE remaining > 0;

CREATE UNIQUE INDEX IF NOT EXISTS uq_vault_points_gift ON vault_points_ledger(user_id, ref_type, ref_id) WHERE kind = 'gift';

CREATE TABLE IF NOT EXISTS vault_credit_accounts (
  user_id TEXT PRIMARY KEY,
  balance_cents INTEGER NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vault_credit_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  ref_type TEXT,
  ref_id TEXT,
  note TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vault_credit_user ON vault_credit_ledger(user_id, created_at);

CREATE TABLE IF NOT EXISTS vault_unlocks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  image_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  points_spent INTEGER NOT NULL,
  unlocked_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  UNIQUE (user_id, image_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_vault_unlocks_user ON vault_unlocks(user_id, expires_at);

CREATE TABLE IF NOT EXISTS vault_downloads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  image_id TEXT NOT NULL,
  downloaded_at TEXT NOT NULL,
  ip_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_vault_downloads_user ON vault_downloads(user_id, downloaded_at);

CREATE TABLE IF NOT EXISTS vault_admin_log (
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
);

CREATE INDEX IF NOT EXISTS idx_vault_admin_log_time ON vault_admin_log(created_at);

INSERT OR IGNORE INTO vault_categories(slug,name,size_kind,sort_order,cad_stones_cents,cad_plain_cents,cad_custom_cents) VALUES
  ('ring','Ring','ring_eu',10,3000,2000,5000),
  ('wedding-band','Wedding band','ring_eu',20,3000,2000,5000),
  ('earring','Earring','none',30,3000,2000,5000),
  ('piercing','Piercing','none',40,3000,2000,5000),
  ('necklace-pendant','Necklace & pendant','none',50,3000,2000,5000),
  ('bracelet-bangle','Bracelet & bangle','bangle_or_bracelet',60,3000,2000,5000),
  ('brooch','Brooch','none',70,3000,2000,5000),
  ('watch-charm','Watch charm','none',80,3000,2000,5000),
  ('set','Set','none',90,5000,4000,7000);

INSERT OR IGNORE INTO vault_styles(slug,name,sort_order) VALUES
  ('luxury','Luxury',10),('minimal','Minimal',20),('classic','Classic',30),('abstract','Abstract',40),
  ('nature','Nature',50),('geometric','Geometric',60),('modern','Modern',70);
