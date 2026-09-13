ALTER TABLE trades ADD COLUMN accounted_at TEXT;

 

CREATE TABLE IF NOT EXISTS trade_accounting (

  id TEXT PRIMARY KEY,

  trade_id TEXT NOT NULL UNIQUE,

  created_at TEXT NOT NULL

);

 

CREATE INDEX IF NOT EXISTS idx_trade_accounting_trade

ON trade_accounting(trade_id);

 

INSERT OR IGNORE INTO trade_accounting(id,trade_id,created_at)

SELECT 'legacy-' || id, id, COALESCE(verified_at,created_at)

FROM trades

WHERE status='confirmed';

 

UPDATE trades

SET accounted_at=COALESCE(verified_at,created_at)

WHERE status='confirmed' AND accounted_at IS NULL;
