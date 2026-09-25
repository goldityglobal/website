-- Atomic per-IP claim counter for the airdrop, replacing the non-atomic
-- SELECT COUNT(*) ... WHERE ip_hash=? check-then-write pattern, which could
-- let a burst of simultaneous requests from the same IP slightly exceed the
-- 100-claims-per-IP limit under a race condition. Uses the same
-- UPDATE ... WHERE claim_count < cap atomic-reservation pattern already used
-- for the global 10,000-claim cap in airdrop_state (see migration 006).
CREATE TABLE IF NOT EXISTS airdrop_ip_state (
  ip_hash TEXT PRIMARY KEY,
  claim_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
