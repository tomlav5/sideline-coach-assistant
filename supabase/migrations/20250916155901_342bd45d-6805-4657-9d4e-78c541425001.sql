-- Fix security warnings by setting proper search paths for functions

-- Update trigger function with proper search path
CREATE OR REPLACE FUNCTION trigger_refresh_reports()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Use pg_notify to signal that reports need refreshing
    PERFORM pg_notify('refresh_reports', json_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP,
        'timestamp', extract(epoch from now()),
        'record_id', COALESCE(NEW.id::text, OLD.id::text)
    )::text);
    RETURN COALESCE(NEW, OLD);
END;
$$;