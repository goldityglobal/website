-- GOLDITY Referral Payouts
-- Safe additive migration.
-- Existing referral reward records are preserved.

PRAGMA foreign_keys = ON;

-- Link referral rewards to a payout operation.
-- Existing rewards remain available until explicitly assigned to a payout.
ALTER TABLE referral_rewards
ADD COLUMN payout_id TEXT;

CREATE INDEX IF NOT EXISTS idx_rewards_payout
ON referral_rewards(payout_id);

-- Referral payout operations.
-- One payout represents one withdrawal request and can contain
-- multiple available referral rewards belonging to the same user.
CREATE TABLE IF NOT EXISTS referral_payouts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  amount_wei TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  tx_hash TEXT,
  created_at TEXT NOT NULL,
  broadcast_at TEXT,
  paid_at TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_referral_payouts_user
ON referral_payouts(user_id);

CREATE INDEX IF NOT EXISTS idx_referral_payouts_status
ON referral_payouts(status);

CREATE INDEX IF NOT EXISTS idx_referral_payouts_tx
ON referral_payouts(tx_hash);

-- Prevent more than one unfinished payout for the same user.
-- A new payout can be created after the previous one becomes
-- paid or failed.
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_payouts_active_user
ON referral_payouts(user_id)
WHERE status IN ('processing', 'broadcast');
