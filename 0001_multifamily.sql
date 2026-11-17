-- Fresh multi-family D1 database: never apply this to your original Santa HQ database.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS households (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS memberships (
  user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner','parent')),
  PRIMARY KEY(user_id,household_id),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(household_id) REFERENCES households(id)
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS invitations (
  token_hash TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  invited_by TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE TABLE IF NOT EXISTS records (
  household_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('gift','mail','profile')),
  id TEXT NOT NULL,
  data TEXT,
  deleted INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(household_id,kind,id)
);
CREATE INDEX IF NOT EXISTS idx_records_family ON records(household_id);
CREATE TABLE IF NOT EXISTS public_lists (
  household_id TEXT PRIMARY KEY,
  share_id TEXT NOT NULL UNIQUE,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS public_claims (
  household_id TEXT NOT NULL,
  gift_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(household_id,gift_id)
);
CREATE TABLE IF NOT EXISTS auth_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  window_started INTEGER NOT NULL
);
