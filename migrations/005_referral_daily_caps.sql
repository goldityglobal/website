-- Atomic per-referrer (or per-IP cap-group) daily reward cap. worker.js's
-- reserveDailyCap() reads/writes this table with an
-- "UPDATE ... WHERE total_milligdty+? <= ?" pattern to enforce the
-- 200 GDTY/day-per-group limit without a race condition.
--
-- NOTE: this table was previously created by running this statement directly
-- in the D1 console, but the migration file itself was missing from the
-- repo's migrations/ folder - meaning a fresh environment (disaster
-- recovery, staging, a clean D1 database) would be missing this table even
-- though worker.js depends on it for every qualifying referral purchase.
-- Adding it here keeps the migrations folder a true, replayable record of
-- the schema. If your production D1 already has this table (applied
-- manually before), this is a harmless no-op thanks to IF NOT EXISTS.
CREATE TABLE IF NOT EXISTS referral_daily_caps (
  cap_group TEXT NOT NULL,
  day TEXT NOT NULL,
  total_milligdty INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (cap_group, day)
);
