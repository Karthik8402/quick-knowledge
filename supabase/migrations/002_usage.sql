-- ============================================================
-- Supabase Migration: Usage Tracking
-- Run these statements in the Supabase SQL Editor.
-- ============================================================

-- STEP 1: Create usage table
CREATE TABLE IF NOT EXISTS usage (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     UUID NOT NULL,
    date        DATE NOT NULL,
    used        INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_date UNIQUE (user_id, date)
);

-- STEP 2: Enable Row Level Security
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;

-- STEP 3: RLS Policies for usage table
CREATE POLICY "Users can view own usage"
    ON usage FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage"
    ON usage FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage"
    ON usage FOR UPDATE
    USING (auth.uid() = user_id);

-- STEP 4: Create stored procedure for atomic increments
CREATE OR REPLACE FUNCTION increment_usage(p_user_id UUID, p_date DATE)
RETURNS INTEGER AS $$
DECLARE
    new_used INTEGER;
BEGIN
    INSERT INTO usage (user_id, date, used)
    VALUES (p_user_id, p_date, 1)
    ON CONFLICT (user_id, date)
    DO UPDATE SET used = usage.used + 1
    RETURNING used INTO new_used;
    
    RETURN new_used;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
