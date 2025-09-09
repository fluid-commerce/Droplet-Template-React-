-- Migration: 002_create_activity_logs.sql
-- Description: Create activity_logs table for tracking droplet activities
-- Created: 2024-01-01

CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_id VARCHAR(255) NOT NULL,
    activity_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    details JSONB,
    status VARCHAR(50) DEFAULT 'success' CHECK (status IN ('success', 'error', 'warning')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_installation_id ON activity_logs(installation_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_activity_type ON activity_logs(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_status ON activity_logs(status);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

-- Add foreign key constraint
ALTER TABLE activity_logs 
ADD CONSTRAINT fk_activity_logs_installation_id 
FOREIGN KEY (installation_id) 
REFERENCES droplet_installations(installation_id) 
ON DELETE CASCADE;

-- Add comments for documentation
COMMENT ON TABLE activity_logs IS 'Tracks all activities and events for droplet installations';
COMMENT ON COLUMN activity_logs.installation_id IS 'Reference to droplet installation';
COMMENT ON COLUMN activity_logs.activity_type IS 'Type of activity (sync, webhook, config_change, etc.)';
COMMENT ON COLUMN activity_logs.description IS 'Human-readable description of the activity';
COMMENT ON COLUMN activity_logs.details IS 'Additional details and data related to the activity';
COMMENT ON COLUMN activity_logs.status IS 'Status of the activity (success, error, warning)';
COMMENT ON COLUMN activity_logs.metadata IS 'Additional metadata for the activity';
