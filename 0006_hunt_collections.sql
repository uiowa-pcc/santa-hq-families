-- Santa HQ Hunt Collections: additive only. Run in your existing D1 database after 0005.
-- Existing hunts, gift records, household profiles, photos and players are unchanged.
CREATE TABLE IF NOT EXISTS hunt_collections (
  hunt_id TEXT PRIMARY KEY REFERENCES hunts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('mega','standalone','legacy')),
  theme TEXT NOT NULL DEFAULT 'random',
  play_mode TEXT NOT NULL DEFAULT 'competition' CHECK(play_mode IN ('competition','solo')),
  clues_json TEXT NOT NULL DEFAULT '[]',
  archived_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS hunt_collections_archive_idx ON hunt_collections(archived_at,created_at DESC);
