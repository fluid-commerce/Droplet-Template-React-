-- Migration: 006_add_customer_api_key.sql
-- Description: Add customer_api_key field to store customer's own Fluid API key
-- Created: 2025-01-12

BEGIN;

-- Add customer_api_key field to store customer's own API key (separate from builder's key)
ALTER TABLE droplet_installations 
ADD COLUMN customer_api_key TEXT;

-- Add index for customer API key lookups
CREATE INDEX IF NOT EXISTS idx_droplet_installations_customer_api_key 
ON droplet_installations(customer_api_key) 
WHERE customer_api_key IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN droplet_installations.customer_api_key IS 'Customer''s own Fluid API key for webhook testing and data operations';

-- Update migration tracking
INSERT INTO migrations (filename, executed_at)
VALUES ('006_add_customer_api_key.sql', NOW())
ON CONFLICT (filename) DO NOTHING;

COMMIT;
