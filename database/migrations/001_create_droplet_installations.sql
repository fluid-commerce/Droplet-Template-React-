-- Migration: 001_create_droplet_installations.sql
-- Description: Create droplet_installations table to store installation data
-- Created: 2024-01-01

CREATE TABLE IF NOT EXISTS droplet_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_id VARCHAR(255) UNIQUE NOT NULL,
    droplet_id VARCHAR(255) NOT NULL,
    company_id VARCHAR(255) NOT NULL,
    authentication_token TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),
    configuration JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_sync_at TIMESTAMP WITH TIME ZONE,
    company_name VARCHAR(255),
    company_data JSONB
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_droplet_installations_installation_id ON droplet_installations(installation_id);
CREATE INDEX IF NOT EXISTS idx_droplet_installations_company_id ON droplet_installations(company_id);
CREATE INDEX IF NOT EXISTS idx_droplet_installations_status ON droplet_installations(status);
CREATE INDEX IF NOT EXISTS idx_droplet_installations_created_at ON droplet_installations(created_at);

-- Add comments for documentation
COMMENT ON TABLE droplet_installations IS 'Stores droplet installation data and configurations';
COMMENT ON COLUMN droplet_installations.installation_id IS 'Unique installation ID from Fluid platform';
COMMENT ON COLUMN droplet_installations.droplet_id IS 'Droplet ID from Fluid platform';
COMMENT ON COLUMN droplet_installations.company_id IS 'Company ID from Fluid platform';
COMMENT ON COLUMN droplet_installations.authentication_token IS 'Authentication token for API calls';
COMMENT ON COLUMN droplet_installations.configuration IS 'JSON configuration data from user';
COMMENT ON COLUMN droplet_installations.company_data IS 'Cached company information from Fluid API';
