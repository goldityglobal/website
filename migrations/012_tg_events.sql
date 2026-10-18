-- GOLDITY Telegram airdrop bot: funnel log
-- Safe additive migration: one new table. Nothing existing is touched.
-- Run this ONE statement in the D1 console (goldity-users). The bot works with or without it.
-- Each (user, event, detail) is stored once, so the table can never grow out of control.

CREATE TABLE IF NOT EXISTS tg_events (
  telegram_user_id TEXT NOT NULL,
  event TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  wallet_address TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (telegram_user_id, event, detail)
);
