-- GOLDITY 10K Airdrop
-- Safe additive migration.

CREATE TABLE IF NOT EXISTS airdrop_claims (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  ip_hash TEXT NOT NULL,
  amount_wei TEXT NOT NULL,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_airdrop_claims_ip ON airdrop_claims(ip_hash);

-- Single-row atomic counter used to enforce the 10,000-claim hard cap safely,
-- the same pattern used for the referral daily cap (see migration 005).
CREATE TABLE IF NOT EXISTS airdrop_state (
  key TEXT PRIMARY KEY,
  value_int INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
