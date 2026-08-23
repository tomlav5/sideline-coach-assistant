-- =====================================================
-- Phase 2: Create Analytics Schema
-- =====================================================
-- Purpose: Create the analytics schema that materialized views depend on
-- Dependencies: None
-- Author: AI Assistant
-- Date: 2025-12-08

-- Create analytics schema for reporting views
CREATE SCHEMA IF NOT EXISTS analytics;

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA analytics TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO authenticated;

-- Set default privileges for future tables in analytics schema
ALTER DEFAULT PRIVILEGES IN SCHEMA analytics GRANT SELECT ON TABLES TO authenticated;

-- Add comment for documentation
COMMENT ON SCHEMA analytics IS 'Schema containing materialized views for reporting and analytics. Views are refreshed via refresh_report_views() function.';

-- Log the creation
DO $$
BEGIN
    RAISE NOTICE 'Analytics schema created successfully at %', now();
END $$;
