-- Phase 5: Telegram notifications tables
-- telegram_users: links member accounts to Telegram
-- telegram_link_tokens: one-time tokens for account linking
-- notification_prefs: add telegram_enabled column

-- 1. telegram_users
CREATE TABLE IF NOT EXISTS telegram_users (
  member_id UUID PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  telegram_id BIGINT UNIQUE NOT NULL,
  telegram_username VARCHAR(64),
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_telegram_users_tg_id ON telegram_users(telegram_id);

-- RLS: user can only read/modify their own row
ALTER TABLE telegram_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY telegram_users_select ON telegram_users
  FOR SELECT USING (member_id = auth.uid());

CREATE POLICY telegram_users_delete ON telegram_users
  FOR DELETE USING (member_id = auth.uid());

-- Service role can do everything (Edge Functions use service_role key)

-- 2. telegram_link_tokens
CREATE TABLE IF NOT EXISTS telegram_link_tokens (
  token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes'),
  used BOOLEAN DEFAULT FALSE
);

ALTER TABLE telegram_link_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY telegram_link_tokens_insert ON telegram_link_tokens
  FOR INSERT WITH CHECK (member_id = auth.uid());

CREATE POLICY telegram_link_tokens_select ON telegram_link_tokens
  FOR SELECT USING (member_id = auth.uid());

-- 3. Add telegram_enabled to notification_prefs
ALTER TABLE notification_prefs
  ADD COLUMN IF NOT EXISTS telegram_enabled BOOLEAN DEFAULT FALSE;

-- 4. notifications table (if not exists) — used as trigger source for notify-worker
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  type VARCHAR(32) NOT NULL,
  title TEXT,
  body TEXT,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_member ON notifications(member_id, created_at DESC);
