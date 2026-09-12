-- GOLDITY Referral Payout Transaction Recovery
-- Safe additive migration.
-- Existing referral payout records are preserved.

PRAGMA foreign_keys = ON;

-- Store the BSC transaction nonce allocated to this payout.
-- The nonce belongs to the shared referral payout wallet.
ALTER TABLE referral_payouts
ADD COLUMN nonce INTEGER;

-- Store the exact gas price and gas limit used to construct the
-- signed legacy BSC transaction. Together with nonce, recipient,
-- amount and transaction data, these values allow the Worker to
-- reconstruct the same transaction after an interrupted request.
ALTER TABLE referral_payouts
ADD COLUMN gas_price_wei TEXT;

ALTER TABLE referral_payouts
ADD COLUMN gas_limit INTEGER;

-- A nonce can only belong to one payout operation.
-- This prevents concurrent payout requests from reserving the
-- same nonce for the shared payout wallet.
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_payouts_nonce
ON referral_payouts(nonce)
WHERE nonce IS NOT NULL;

-- A transaction hash must identify only one payout operation.
-- Existing NULL tx_hash values are excluded.
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_payouts_tx_hash_unique
ON referral_payouts(tx_hash)
WHERE tx_hash IS NOT NULL;

-- Useful for recovery/reconciliation of payouts that already
-- have a transaction nonce assigned but are not yet completed.
CREATE INDEX IF NOT EXISTS idx_referral_payouts_recovery
ON referral_payouts(status, nonce);
