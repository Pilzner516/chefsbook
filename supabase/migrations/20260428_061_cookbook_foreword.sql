-- Migration 061: Add foreword column to printed cookbooks
-- Allows users to add a personal message/dedication to their cookbook

ALTER TABLE printed_cookbooks
  ADD COLUMN IF NOT EXISTS foreword TEXT;

-- Foreword text is limited to 1000 characters in the UI
-- but we use TEXT type to avoid any truncation issues
