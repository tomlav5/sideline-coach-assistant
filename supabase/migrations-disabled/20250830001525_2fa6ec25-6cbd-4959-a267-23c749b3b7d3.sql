-- Add squad selection storage to fixtures table
ALTER TABLE public.fixtures 
ADD COLUMN selected_squad_data JSONB;

-- Add index for better performance
CREATE INDEX idx_fixtures_selected_squad ON public.fixtures USING GIN(selected_squad_data);