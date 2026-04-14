-- Migration 035: Add 'chef' value to plan_tier enum
ALTER TYPE plan_tier ADD VALUE IF NOT EXISTS 'chef';
