-- Migration 071: Add menu_scan_enabled flag to user_profiles
-- Admin-controlled flag for restaurant menu scan capability (Pro users only, default OFF)

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS menu_scan_enabled BOOLEAN NOT NULL DEFAULT false;
