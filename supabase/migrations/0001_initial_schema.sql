-- ============================================================================
-- STRAWBERRY: Supabase PostgreSQL migration
-- Mirrors the original SQLite schema (server/database/strawberry.db) 1:1.
--
-- Apply via Supabase Dashboard > SQL Editor, or with the Supabase CLI:
--   supabase db push
--
-- The application accesses these tables through the Supabase SERVICE ROLE key
-- (server-side only). All tables are created with RLS disabled so the service
-- role and owner can read/write directly. Enable RLS + policies if you ever
-- intend to use the anon key client-side.
-- ============================================================================

-- gen_random_uuid() (PG 13+ has it built-in; extension kept for older versions)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL DEFAULT '',
  email         TEXT NOT NULL DEFAULT '',
  bio           TEXT DEFAULT '',
  photo_url     TEXT DEFAULT '',
  currency      TEXT DEFAULT 'LKR',
  notifications JSONB NOT NULL DEFAULT '{"email":true,"push":false,"inApp":true,"earlyWarning":"3","paymentDay":"due"}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- users_auth
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users_auth (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  full_name      TEXT NOT NULL DEFAULT '',
  email_verified BOOLEAN NOT NULL DEFAULT TRUE,
  provider       TEXT DEFAULT 'email',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount                  DOUBLE PRECISION NOT NULL DEFAULT 0,
  category                TEXT NOT NULL DEFAULT '',
  description             TEXT DEFAULT '',
  date                    DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url             TEXT DEFAULT '',
  split_with              TEXT DEFAULT '',
  subject                 TEXT DEFAULT '',
  merchant                TEXT DEFAULT '',
  currency                TEXT DEFAULT 'LKR',
  reimbursable            BOOLEAN NOT NULL DEFAULT FALSE,
  employee                TEXT DEFAULT '',
  add_to_report           BOOLEAN NOT NULL DEFAULT FALSE,
  tags                    JSONB NOT NULL DEFAULT '[]',
  is_recurring            BOOLEAN NOT NULL DEFAULT FALSE,
  frequency               TEXT DEFAULT '',
  end_date                DATE,
  recurring_status        TEXT DEFAULT '',
  recurring_notifications BOOLEAN NOT NULL DEFAULT FALSE,
  icon                    TEXT DEFAULT '',
  payment_method          TEXT DEFAULT '',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- debtors
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS debtors (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  debtor_name  TEXT NOT NULL DEFAULT '',
  phone_number TEXT DEFAULT '',
  email        TEXT DEFAULT '',
  amount       DOUBLE PRECISION NOT NULL DEFAULT 0,
  paid_amount  DOUBLE PRECISION NOT NULL DEFAULT 0,
  expense_id   UUID,
  notes        TEXT DEFAULT '',
  status       TEXT DEFAULT 'pending',
  date         DATE DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at      TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debtor_id   UUID NOT NULL REFERENCES debtors(id) ON DELETE CASCADE,
  debtor_name TEXT NOT NULL DEFAULT '',
  amount      DOUBLE PRECISION NOT NULL DEFAULT 0,
  date        DATE DEFAULT CURRENT_DATE,
  method      TEXT DEFAULT '',
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

-- ---------------------------------------------------------------------------
-- feedback
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feedback (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT DEFAULT '',
  email      TEXT DEFAULT '',
  message    TEXT DEFAULT '',
  type       TEXT DEFAULT '',
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes (kept in sync with the SQLite schema)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_expenses_user_id     ON expenses (user_id);
CREATE INDEX IF NOT EXISTS idx_debtors_user_id      ON debtors (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id     ON payments (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_debtor_id   ON payments (debtor_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_id   ON categories (user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id     ON feedback (user_id);

-- ---------------------------------------------------------------------------
-- Permissions for the service-role key (bypasses RLS, listed explicitly so
-- freshly created tables work even if a project's default privileges differ).
-- ---------------------------------------------------------------------------
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;