-- Migration: 005_update_status_constraint.sql
-- Description: Update status constraint to allow 'pending' status
-- Created: 2025-01-09

-- Drop the existing constraint
ALTER TABLE droplet_installations DROP CONSTRAINT IF EXISTS droplet_installations_status_check;

-- Add the new constraint with 'pending' included
ALTER TABLE droplet_installations ADD CONSTRAINT droplet_installations_status_check 
CHECK (status IN ('active', 'inactive', 'suspended', 'pending'));