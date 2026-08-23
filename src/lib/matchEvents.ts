// Mirrors the match_events_event_type_check constraint in supabase/production_schema.sql
export const MATCH_EVENT_TYPES = ['goal', 'assist', 'substitution_on', 'substitution_off'] as const;

export type MatchEventType = (typeof MATCH_EVENT_TYPES)[number];
