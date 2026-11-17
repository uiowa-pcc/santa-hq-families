-- Additive migration for Santa HQ Families. Run ONCE on the existing santa-hq-families D1.
-- Do not run on your original single-family Santa HQ database.
ALTER TABLE users ADD COLUMN email_verified_at INTEGER;
ALTER TABLE users ADD COLUMN verification_required INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN recovery_hash TEXT;
CREATE TABLE IF NOT EXISTS account_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK(purpose IN ('verify','reset')),
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_account_tokens_user ON account_tokens(user_id,purpose);
