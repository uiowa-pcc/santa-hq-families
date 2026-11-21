-- Santa HQ Hunt HQ — additive migration; run ONCE in existing Cloudflare D1 Console.
-- Creates no gift or family-account tables and does not alter existing hunts.
CREATE TABLE IF NOT EXISTS hunt_nights (
 id TEXT PRIMARY KEY,
 hunt_id TEXT NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,
 theme TEXT NOT NULL,
 title TEXT NOT NULL,
 clues_json TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS hunt_nights_parent_idx ON hunt_nights(hunt_id,created_at);
CREATE TABLE IF NOT EXISTS hunt_night_progress (
 night_id TEXT NOT NULL REFERENCES hunt_nights(id) ON DELETE CASCADE,
 player_id TEXT NOT NULL REFERENCES hunt_players(id) ON DELETE CASCADE,
 found_json TEXT NOT NULL DEFAULT '[]',
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(night_id,player_id)
);
CREATE TABLE IF NOT EXISTS hunt_direct_progress (
 player_id TEXT PRIMARY KEY REFERENCES hunt_players(id) ON DELETE CASCADE,
 found_json TEXT NOT NULL DEFAULT '[]',
 updated_at INTEGER NOT NULL
);
-- Bonus clue photos are separate from the existing 0–29 main-hunt photo table.
CREATE TABLE IF NOT EXISTS hunt_night_photos (
 id TEXT PRIMARY KEY,
 hunt_id TEXT NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,
 night_id TEXT NOT NULL REFERENCES hunt_nights(id) ON DELETE CASCADE,
 player_id TEXT NOT NULL REFERENCES hunt_players(id) ON DELETE CASCADE,
 clue_index INTEGER NOT NULL,
 object_key TEXT NOT NULL,
 shared INTEGER NOT NULL DEFAULT 0 CHECK(shared IN (0,1)),
 created_at INTEGER NOT NULL,
 UNIQUE(night_id,player_id,clue_index)
);
CREATE INDEX IF NOT EXISTS hunt_night_photo_feed_idx ON hunt_night_photos(hunt_id,shared,created_at DESC);
