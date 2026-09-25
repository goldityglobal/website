-- Adds canonical_email so duplicate-account detection via Gmail-style
-- plus-tags/dots is symmetric regardless of which alias variant registers
-- first (see worker.js registerUser). Safe, additive change - no existing
-- column is touched and no UNIQUE constraint is added (some legacy rows may
-- already collide on their canonical form; enforcing uniqueness retroactively
-- is a separate, deliberate cleanup step, not a blind migration).
ALTER TABLE users ADD COLUMN canonical_email TEXT;

CREATE INDEX IF NOT EXISTS idx_users_canonical_email ON users(canonical_email);

-- Best-effort backfill for existing accounts: strips a "+tag" from the local
-- part. Gmail's dot-insensitivity is NOT backfilled here (not expressible in
-- a single portable SQL statement) - only newly registered accounts get the
-- fully correct canonical form computed in JS (canonicalEmailKey). This is
-- fine: it only affects detecting duplicates among pre-existing rows, not
-- the fix's main goal of catching new duplicate registrations going forward.
UPDATE users
SET canonical_email = CASE
  WHEN INSTR(email,'+') > 0 AND INSTR(email,'+') < INSTR(email,'@')
    THEN SUBSTR(email,1,INSTR(email,'+')-1) || SUBSTR(email,INSTR(email,'@'))
  ELSE email
END
WHERE canonical_email IS NULL;
