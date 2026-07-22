-- ============================================================
-- SHAKTI TRADERS — Supabase Database Setup Script
-- Run this entire script in Supabase → SQL Editor → New query
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- 1. PURCHASES table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchases (
  id                       BIGSERIAL PRIMARY KEY,
  created_at               TIMESTAMPTZ DEFAULT NOW(),

  -- Date of purchase entry
  date                     TEXT NOT NULL,

  -- TSS fields
  tss_quantity             NUMERIC DEFAULT 0,
  tss_amount               NUMERIC DEFAULT 0,
  tss_sold_quantity        NUMERIC DEFAULT 0,
  tss_remaining_quantity   NUMERIC DEFAULT 0,

  -- TMS fields
  tms_quantity             NUMERIC DEFAULT 0,
  tms_amount               NUMERIC DEFAULT 0,
  tms_sold_quantity        NUMERIC DEFAULT 0,
  tms_remaining_quantity   NUMERIC DEFAULT 0,

  -- Combined totals (calculated at save time)
  total_quantity           NUMERIC DEFAULT 0,
  total_amount             NUMERIC DEFAULT 0,
  total_sold_quantity      NUMERIC DEFAULT 0,
  total_remaining_quantity NUMERIC DEFAULT 0,

  -- SLNK = total_amount + (total_quantity × 4)
  slnk_quantity            NUMERIC DEFAULT 0,
  slnk_amount              NUMERIC DEFAULT 0
);


-- ─────────────────────────────────────────────────────────────
-- 2. SELLINGS table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sellings (
  id                      BIGSERIAL PRIMARY KEY,
  created_at              TIMESTAMPTZ DEFAULT NOW(),

  date                    TEXT NOT NULL,

  -- Stock available at time of sale
  available_tss_quantity  NUMERIC DEFAULT 0,
  available_tms_quantity  NUMERIC DEFAULT 0,
  available_quantity      NUMERIC DEFAULT 0,

  -- Quantities sold in this entry
  tss_selling_quantity    NUMERIC DEFAULT 0,
  tms_selling_quantity    NUMERIC DEFAULT 0,
  selling_quantity        NUMERIC DEFAULT 0,

  -- Sale value and notes
  amount                  NUMERIC DEFAULT 0,
  description             TEXT    DEFAULT '',

  -- Remaining after this sale
  remaining_tss_quantity  NUMERIC DEFAULT 0,
  remaining_tms_quantity  NUMERIC DEFAULT 0,
  remaining_quantity      NUMERIC DEFAULT 0
);


-- ─────────────────────────────────────────────────────────────
-- 3. META table  (key-value store for app settings)
--    Used for: manual sold quantity totals (TSS / TMS)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meta (
  id         BIGSERIAL PRIMARY KEY,
  key        TEXT UNIQUE NOT NULL,
  value      TEXT   -- stored as JSON string
);


-- ─────────────────────────────────────────────────────────────
-- 4. Row Level Security
--    The app uses its own hardcoded login (not Supabase Auth),
--    so we allow all operations via anon key.
--    ⚠️  For a production app you should restrict these policies.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE sellings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta      ENABLE ROW LEVEL SECURITY;

-- Allow full CRUD for the anon role on all three tables
CREATE POLICY "allow_all_purchases" ON purchases FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_sellings"  ON sellings  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_meta"      ON meta      FOR ALL TO anon USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────
-- Done! After running this, go to js/config.js and paste:
--   SUPABASE_URL      — from Settings → API → Project URL
--   SUPABASE_ANON_KEY — from Settings → API → anon/public key
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- v4 MIGRATION: SLNK Amount is now manual
-- If your purchases table already exists, run this to ensure
-- the slnk_amount column accepts any value (no formula).
-- The column already exists from the original setup — no change
-- to schema is needed. Just stop auto-calculating it in JS.
-- ─────────────────────────────────────────────────────────────
-- (No schema changes required for v4)

-- ─────────────────────────────────────────────────────────────
-- v6 MIGRATION: Notes module + Selling Bill Number
-- Run this in Supabase → SQL Editor. Safe to re-run (IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────

-- 5. NOTES table
CREATE TABLE IF NOT EXISTS notes (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT NOW(),

  date        TEXT NOT NULL,

  -- PAKKA (bag counts)
  pakka_tss   NUMERIC DEFAULT 0,
  pakka_tms   NUMERIC DEFAULT 0,

  -- Quantity (kg)
  qty_tss     NUMERIC DEFAULT 0,
  qty_tms     NUMERIC DEFAULT 0,

  description TEXT DEFAULT ''
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notes' AND policyname = 'allow_all_notes'
  ) THEN
    CREATE POLICY "allow_all_notes" ON notes FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 6. Selling — Bill Number column
ALTER TABLE sellings ADD COLUMN IF NOT EXISTS bill_number TEXT DEFAULT '';
