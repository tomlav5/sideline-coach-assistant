import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { generateUUID } from '@/lib/uuid';

interface RetrospectiveMatchData {
  fixture_id: string;
  periods: Array<{
    period_number: number;
    duration_minutes: number;
  }>;
  events: Array<{
    event_type: 'goal' | 'assist' | 'substitution_on' | 'substitution_off';
    player_id?: string;
    assist_player_id?: string;
    period_number: number;
    minute_in_period: number;
    is_our_team: boolean;
    is_penalty?: boolean;
    notes?: string;
  }>;
  player_times: Array<{
    player_id: string;
    period_number: number;
    time_on_minute?: number;
    time_off_minute?: number;
    is_starter: boolean;
  }>;
}

export function useRetrospectiveMatch() {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const saveRetrospectiveMatch = async (data: RetrospectiveMatchData) => {
    setIsLoading(true);
    
    try {
      // Mark fixture as retrospective and completed
      const { error: fixtureError } = await supabase
        .from('fixtures')
        .update({
          is_retrospective: true,
          status: 'completed',
          match_status: 'completed',
          match_state: {
            status: 'completed',
            total_time_seconds: data.periods.reduce((sum, p) => sum + (p.duration_minutes * 60), 0),
          }
        })
        .eq('id', data.fixture_id);

      if (fixtureError) throw fixtureError;

      // Check for existing periods first to avoid duplicate key errors
      const { data: existingPeriods } = await supabase
        .from('match_periods')
        .select('id, period_number')
        .eq('fixture_id', data.fixture_id);

      const existingPeriodNumbers = new Set(existingPeriods?.map(p => p.period_number) || []);

      // Only insert periods that don't already exist
      const periodsToInsert = data.periods
        .filter(period => !existingPeriodNumbers.has(period.period_number))
        .map(period => ({
          fixture_id: data.fixture_id,
          period_number: period.period_number,
          planned_duration_minutes: period.duration_minutes,
          actual_start_time: new Date().toISOString(), // Placeholder
          actual_end_time: new Date().toISOString(), // Placeholder
          is_active: false,
          total_paused_seconds: 0,
        }));

      let insertedPeriods = existingPeriods || [];

      // Only insert if there are new periods to add
      if (periodsToInsert.length > 0) {
        const { data: newPeriods, error: periodsError } = await supabase
          .from('match_periods')
          .insert(periodsToInsert)
          .select();

        if (periodsError) throw periodsError;
        insertedPeriods = [...existingPeriods || [], ...newPeriods || []];
      }

      // Create events with calculated total match minutes (idempotent via client_event_id)
      let totalMinutes = 0;
      const eventsToInsert = [];

      for (const event of data.events) {
        const periodData = data.periods.find(p => p.period_number === event.period_number);
        const periodId = insertedPeriods?.find(p => p.period_number === event.period_number)?.id;
        
        if (!periodData || !periodId) continue;

        // Calculate total match minute
        const previousPeriodsTime = data.periods
          .filter(p => p.period_number < event.period_number)
          .reduce((sum, p) => sum + p.duration_minutes, 0);
        
        const totalMatchMinute = previousPeriodsTime + event.minute_in_period;

        const clientEventId = generateUUID();

        eventsToInsert.push({
          fixture_id: data.fixture_id,
          period_id: periodId,
          event_type: event.event_type,
          player_id: event.player_id,
          assist_player_id: event.assist_player_id,
          minute_in_period: event.minute_in_period,
          total_match_minute: totalMatchMinute,
          is_our_team: event.is_our_team,
          is_penalty: event.is_penalty || false,
          notes: event.notes,
          is_retrospective: true,
          client_event_id: clientEventId,
        });
      }

      if (eventsToInsert.length > 0) {
        const { error: eventsError } = await supabase
          .from('match_events')
          .upsert(eventsToInsert, { onConflict: 'client_event_id' });

        if (eventsError) throw eventsError;
      }

      // Create player time logs
      const timeLogsToInsert = [];

      for (const playerTime of data.player_times) {
        const periodId = insertedPeriods?.find(p => p.period_number === playerTime.period_number)?.id;
        const periodData = data.periods.find(p => p.period_number === playerTime.period_number);
        
        if (!periodId || !periodData) continue;

        // Calculate total period minutes for player
        let totalPeriodMinutes = 0;
        if (playerTime.is_starter && !playerTime.time_off_minute) {
          totalPeriodMinutes = periodData.duration_minutes;
        } else if (playerTime.is_starter && playerTime.time_off_minute) {
          totalPeriodMinutes = playerTime.time_off_minute;
        } else if (!playerTime.is_starter && playerTime.time_on_minute && !playerTime.time_off_minute) {
          totalPeriodMinutes = periodData.duration_minutes - playerTime.time_on_minute;
        } else if (!playerTime.is_starter && playerTime.time_on_minute && playerTime.time_off_minute) {
          totalPeriodMinutes = playerTime.time_off_minute - playerTime.time_on_minute;
        }

        timeLogsToInsert.push({
          fixture_id: data.fixture_id,
          player_id: playerTime.player_id,
          period_id: periodId,
          time_on_minute: playerTime.time_on_minute,
          time_off_minute: playerTime.time_off_minute,
          is_starter: playerTime.is_starter,
          is_active: false, // Match is completed
          total_period_minutes: totalPeriodMinutes,
        });
      }

      if (timeLogsToInsert.length > 0) {
        const { error: timeLogsError } = await supabase
          .from('player_time_logs')
          .insert(timeLogsToInsert);

        if (timeLogsError) throw timeLogsError;
      }

      // HOTFIX: Disabled - analytics schema and materialized views don't exist
      // TODO: Re-enable after Phase 2 database migration
      // try {
      //   await supabase.rpc('refresh_report_views');
      // } catch (refreshError) {
      //   console.error('Error refreshing report views:', refreshError);
      // }
      console.log('Skipping view refresh - analytics schema not yet created');
      
      // Invalidate relevant query caches
      queryClient.invalidateQueries({ queryKey: ['completed-matches'] });
      queryClient.invalidateQueries({ queryKey: ['goal-scorers'] });
      queryClient.invalidateQueries({ queryKey: ['player-playing-time'] });
      queryClient.invalidateQueries({ queryKey: ['competitions'] });

      toast.success('Retrospective match data saved successfully');
      return true;
    } catch (error: any) {
      console.error('Error saving retrospective match:', error);
      toast.error(error?.message || 'Failed to save retrospective match data');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    saveRetrospectiveMatch,
    isLoading,
  };
}