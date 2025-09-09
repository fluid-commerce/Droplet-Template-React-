-- Migration: 004_create_custom_data.sql
-- Description: Create custom_data table for storing droplet-specific data
-- Created: 2024-01-01

CREATE TABLE IF NOT EXISTS custom_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_id VARCHAR(255) NOT NULL,
    data_type VARCHAR(100) NOT NULL,
    data_key VARCHAR(255) NOT NULL,
    data_value JSONB NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique combination of installation_id, data_type, and data_key
    UNIQUE(installation_id, data_type, data_key)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_custom_data_installation_id ON custom_data(installation_id);
CREATE INDEX IF NOT EXISTS idx_custom_data_data_type ON custom_data(data_type);
CREATE INDEX IF NOT EXISTS idx_custom_data_data_key ON custom_data(data_key);
CREATE INDEX IF NOT EXISTS idx_custom_data_created_at ON custom_data(created_at);

-- Add foreign key constraint
ALTER TABLE custom_data 
ADD CONSTRAINT fk_custom_data_installation_id 
FOREIGN KEY (installation_id) 
REFERENCES droplet_installations(installation_id) 
ON DELETE CASCADE;

-- Add comments for documentation
COMMENT ON TABLE custom_data IS 'Stores custom data specific to each droplet installation';
COMMENT ON COLUMN custom_data.installation_id IS 'Reference to droplet installation';
COMMENT ON COLUMN custom_data.data_type IS 'Type of custom data (user_preferences, cache, etc.)';
COMMENT ON COLUMN custom_data.data_key IS 'Unique key for the data within the type';
COMMENT ON COLUMN custom_data.data_value IS 'The actual data stored as JSON';
COMMENT ON COLUMN custom_data.metadata IS 'Additional metadata about the data';
