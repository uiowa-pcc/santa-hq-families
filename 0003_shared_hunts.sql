-- Run once in Cloudflare D1 Console for santa-hq-families.
-- Only nicknames and clue counts are public to people holding a hunt link.
-- Does not modify existing users, gifts, family settings, or claims.
CREATE TABLE IF NOT EXISTS hunts (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('easy','family')),
  seed TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS hunts_expires_idx ON hunts(expires_at);
CREATE TABLE IF NOT EXISTS hunt_players (
  id TEXT PRIMARY KEY,
  hunt_id TEXT NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL,
  found_json TEXT NOT NULL DEFAULT '[]',
  finished_at INTEGER,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS hunt_players_hunt_idx ON hunt_players(hunt_id);
