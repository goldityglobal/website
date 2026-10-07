-- GOLDITY Telegram airdrop
-- Safe additive migration: one new table and one index. Nothing existing is touched.
-- Run the two statements below ONE AT A TIME in the D1 console (goldity-users).

CREATE TABLE IF NOT EXISTS tg_airdrop_claims (
  id TEXT PRIMARY KEY,
  telegram_user_id TEXT NOT NULL UNIQUE,
  chat_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL UNIQUE,
  amount_wei TEXT NOT NULL,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  reject_reason TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  retry_after TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tg_airdrop_status_created ON tg_airdrop_claims(status, created_at);
