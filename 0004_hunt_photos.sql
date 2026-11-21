-- Santa HQ Photo Hunt: run once in Cloudflare D1 Console before creating photo hunts.
-- Keeps guest photos separate from private household gifts and Santa Mail.
CREATE TABLE IF NOT EXISTS hunt_photos (
 id TEXT PRIMARY KEY,
 hunt_id TEXT NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,
 player_id TEXT NOT NULL REFERENCES hunt_players(id) ON DELETE CASCADE,
 clue_index INTEGER NOT NULL CHECK(clue_index BETWEEN 0 AND 29),
 object_key TEXT NOT NULL,
 shared INTEGER NOT NULL DEFAULT 0 CHECK(shared IN (0,1)),
 created_at INTEGER NOT NULL,
 UNIQUE(hunt_id,player_id,clue_index)
);
CREATE INDEX IF NOT EXISTS hunt_photos_feed_idx ON hunt_photos(hunt_id,shared,created_at DESC);
CREATE INDEX IF NOT EXISTS hunt_photos_player_idx ON hunt_photos(hunt_id,player_id);
