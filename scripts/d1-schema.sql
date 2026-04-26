-- Schema for the daily-results leaderboard backed by Cloudflare D1.
-- Apply once per environment:
--
--   wrangler d1 execute <DB_NAME> --remote --file=scripts/d1-schema.sql
--
-- Re-runnable: every CREATE uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS daily_results (
  client_id    TEXT    NOT NULL,
  puzzle_date  TEXT    NOT NULL,                  -- YYYY-MM-DD
  guess_count  INTEGER NOT NULL,
  won          INTEGER NOT NULL,                  -- 0 / 1
  chosen_clues TEXT,                              -- JSON-encoded
  duration_ms  INTEGER,
  created_at   INTEGER NOT NULL,                  -- Unix ms
  PRIMARY KEY (client_id, puzzle_date)
);

-- Per-day reads dominate (aggregate + percentile both filter on
-- puzzle_date), so an explicit index keeps them off a full table scan
-- once history accumulates.
CREATE INDEX IF NOT EXISTS idx_daily_results_date
  ON daily_results(puzzle_date);
