-- Migration: 003_create_webhook_events.sql
-- Description: Create webhook_events table for storing webhook data
-- Created: 2024-01-01

CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_id VARCHAR(255),
    payload JSONB NOT NULL,
    headers JSONB,
    signature VARCHAR(500),
    processed BOOLEAN DEFAULT FALSE,
    processing_status VARCHAR(50) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_webhook_events_installation_id ON webhook_events(installation_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processing_status ON webhook_events(processing_status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);

-- Add foreign key constraint
ALTER TABLE webhook_events 
ADD CONSTRAINT fk_webhook_events_installation_id 
FOREIGN KEY (installation_id) 
REFERENCES droplet_installations(installation_id) 
ON DELETE CASCADE;

-- Add comments for documentation
COMMENT ON TABLE webhook_events IS 'Stores incoming webhook events from Fluid platform';
COMMENT ON COLUMN webhook_events.installation_id IS 'Reference to droplet installation';
COMMENT ON COLUMN webhook_events.event_type IS 'Type of webhook event';
COMMENT ON COLUMN webhook_events.event_id IS 'Unique event ID from Fluid platform';
COMMENT ON COLUMN webhook_events.payload IS 'Full webhook payload data';
COMMENT ON COLUMN webhook_events.headers IS 'HTTP headers from webhook request';
COMMENT ON COLUMN webhook_events.signature IS 'Webhook signature for verification';
COMMENT ON COLUMN webhook_events.processed IS 'Whether the event has been processed';
COMMENT ON COLUMN webhook_events.processing_status IS 'Current processing status';
COMMENT ON COLUMN webhook_events.retry_count IS 'Number of retry attempts';
