-- GOLDITY Platform Upgrade
-- Safe additive migration. Existing tables are preserved.

PRAGMA foreign_keys = ON;

-- User roles
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';

CREATE INDEX IF NOT EXISTS idx_users_role
ON users(role);

-- Verified wallet ownership challenges
CREATE TABLE IF NOT EXISTS wallet_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  nonce TEXT NOT NULL UNIQUE,
  message TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wallet_challenges_user
ON wallet_challenges(user_id);

CREATE INDEX IF NOT EXISTS idx_wallet_challenges_wallet
ON wallet_challenges(wallet_address);

-- Verified wallet bindings
CREATE TABLE IF NOT EXISTS wallets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  address TEXT NOT NULL UNIQUE,
  chain_id INTEGER NOT NULL DEFAULT 56,
  verified INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wallets_user
ON wallets(user_id);

-- On-chain trades verified by the GOLDITY backend
CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  tx_hash TEXT NOT NULL UNIQUE,
  block_number INTEGER NOT NULL,
  block_timestamp TEXT NOT NULL,
  dex TEXT NOT NULL,
  pair_address TEXT NOT NULL,
  side TEXT NOT NULL,
  gdty_amount_wei TEXT NOT NULL,
  usdt_amount_wei TEXT NOT NULL,
  price_usdt_per_gdty TEXT NOT NULL,
  confirmations INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  verified_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_trades_user
ON trades(user_id);

CREATE INDEX IF NOT EXISTS idx_trades_wallet
ON trades(wallet_address);

CREATE INDEX IF NOT EXISTS idx_trades_status
ON trades(status);

CREATE INDEX IF NOT EXISTS idx_trades_block
ON trades(block_number);

-- Referral rewards ledger
CREATE TABLE IF NOT EXISTS referral_rewards (
  id TEXT PRIMARY KEY,
  referrer_user_id TEXT NOT NULL,
  referred_user_id TEXT NOT NULL,
  trade_id TEXT NOT NULL UNIQUE,
  source_tx_hash TEXT NOT NULL UNIQUE,
  gdty_amount_wei TEXT NOT NULL,
  reward_amount_wei TEXT NOT NULL,
  reward_rate_bps INTEGER NOT NULL DEFAULT 500,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  available_at TEXT,
  paid_at TEXT,
  payout_tx_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_rewards_referrer
ON referral_rewards(referrer_user_id);

CREATE INDEX IF NOT EXISTS idx_rewards_status
ON referral_rewards(status);

-- Portfolio snapshots / accounting
CREATE TABLE IF NOT EXISTS portfolio_accounts (
  user_id TEXT PRIMARY KEY,
  gdty_bought_wei TEXT NOT NULL DEFAULT '0',
  gdty_sold_wei TEXT NOT NULL DEFAULT '0',
  usdt_spent_wei TEXT NOT NULL DEFAULT '0',
  usdt_received_wei TEXT NOT NULL DEFAULT '0',
  cost_basis_wei TEXT NOT NULL DEFAULT '0',
  realized_pnl_wei TEXT NOT NULL DEFAULT '0',
  updated_at TEXT NOT NULL
);

-- User notifications
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user
ON notifications(user_id, created_at);

-- Support tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  ticket_number TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  assigned_to TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user
ON support_tickets(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status
ON support_tickets(status);

-- Support messages
CREATE TABLE IF NOT EXISTS support_messages (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  sender_user_id TEXT,
  sender_role TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket
ON support_messages(ticket_id, created_at);

-- News / announcements
CREATE TABLE IF NOT EXISTS news (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  author_user_id TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_news_status_date
ON news(status, published_at);

-- SEO resources
CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  author_user_id TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_resources_status_date
ON resources(status, published_at);

-- Security / audit events
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  event_type TEXT NOT NULL,
  ip_hash TEXT,
  user_agent_hash TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_user
ON audit_log(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_event
ON audit_log(event_type, created_at);

-- Rate-limit buckets
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Persistent scanner state
CREATE TABLE IF NOT EXISTS scanner_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
