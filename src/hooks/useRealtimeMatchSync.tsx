import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface MatchTracker {
  id: string;
  isActiveTracker: boolean;
  trackerStartedAt?: string;
}

export function useRealtimeMatchSync(fixtureId: string | undefined) {
  const [matchTracker, setMatchTracker] = useState<MatchTracker | null>(null);
  const [isClaimingMatch, setIsClaimingMatch] = useState(false);
  const { toast } = useToast();

  // Claim match tracking
  const claimMatchTracking = useCallback(async () => {
    if (!fixtureId) return false;

    setIsClaimingMatch(true);
    try {
      const { data, error } = await supabase.rpc('claim_match_tracking', {
        fixture_id_param: fixtureId
      });

      if (error) {
        console.error('Error claiming match tracking:', error);
        toast({
          title: "Error",
          description: "Failed to claim match tracking",
          variant: "destructive"
        });
        return false;
      }

      const result = data as any;
      
      if (!result.success) {
        toast({
          title: "Match Already Being Tracked",
          description: result.error || "Another user is currently tracking this match",
          variant: "destructive"
        });
        return false;
      }

      toast({
        title: "Match Tracking Claimed",
        description: "You are now the active match tracker",
      });

      setMatchTracker({
        id: fixtureId,
        isActiveTracker: true,
        trackerStartedAt: result.tracking_started_at
      });

      return true;
    } catch (error) {
      console.error('Error claiming match tracking:', error);
      toast({
        title: "Error",
        description: "Failed to claim match tracking",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsClaimingMatch(false);
    }
  }, [fixtureId, toast]);

  // Release match tracking
  const releaseMatchTracking = useCallback(async () => {
    if (!fixtureId) return;

    try {
      const { error } = await supabase.rpc('release_match_tracking', {
        fixture_id_param: fixtureId
      });

      if (error) {
        console.error('Error releasing match tracking:', error);
        return;
      }

      setMatchTracker(null);
      toast({
        title: "Match Tracking Released",
        description: "You are no longer the active tracker",
      });
    } catch (error) {
      console.error('Error releasing match tracking:', error);
    }
  }, [fixtureId, toast]);

  // Send heartbeat to maintain active status
  const sendHeartbeat = useCallback(async () => {
    if (!fixtureId || !matchTracker?.isActiveTracker) return;

    try {
      await supabase.rpc('update_tracking_activity', {
        fixture_id_param: fixtureId
      });
    } catch (error) {
      console.error('Error sending heartbeat:', error);
    }
  }, [fixtureId, matchTracker?.isActiveTracker]);

  // Set up heartbeat interval
  useEffect(() => {
    if (!matchTracker?.isActiveTracker) return;

    const heartbeatInterval = setInterval(sendHeartbeat, 30000); // Every 30 seconds

    return () => clearInterval(heartbeatInterval);
  }, [matchTracker?.isActiveTracker, sendHeartbeat]);

  // Set up realtime subscriptions
  useEffect(() => {
    if (!fixtureId) return;

    // Subscribe to fixture changes (for tracking status)
    const fixtureChannel = supabase
      .channel(`fixture-${fixtureId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fixtures',
          filter: `id=eq.${fixtureId}`
        },
        (payload) => {
          console.log('Fixture update:', payload);
          
          if (payload.eventType === 'UPDATE') {
            const newData = payload.new as any;
            // If fixture completed, clear local tracker and localStorage
            if (newData.match_status === 'completed' || newData.status === 'completed') {
              try {
                if (typeof window !== 'undefined') {
                  localStorage.removeItem(`match_${fixtureId}`);
                }
              } catch {}
              setMatchTracker(null);
              toast({ title: 'Match completed', description: 'Live tracking session ended.' });
              return;
            }
            
            // Update tracker status based on database changes
            if (newData.active_tracker_id) {
              // Check if current user is the active tracker
              supabase.auth.getUser().then(({ data: { user } }) => {
                const isCurrentUserTracker = user && newData.active_tracker_id === user.id;
                
                setMatchTracker({
                  id: fixtureId,
                  isActiveTracker: isCurrentUserTracker || false,
                  trackerStartedAt: newData.tracking_started_at
                });

                // Show notification if someone else took control
                if (!isCurrentUserTracker && matchTracker?.isActiveTracker) {
                  toast({
                    title: "Match Control Lost",
                    description: "Another user has taken control of this match",
                    variant: "destructive"
                  });
                }
              });
            } else {
              // No active tracker
              setMatchTracker(null);
            }
          }
        }
      )
      .subscribe();

    // Subscribe to match events
    const eventsChannel = supabase
      .channel(`match-events-${fixtureId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_events',
          filter: `fixture_id=eq.${fixtureId}`
        },
        (payload) => {
          console.log('Match event update:', payload);
          // Events will be handled by existing hooks that refetch data
        }
      )
      .subscribe();

    // Subscribe to match periods
    const periodsChannel = supabase
      .channel(`match-periods-${fixtureId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_periods',
          filter: `fixture_id=eq.${fixtureId}`
        },
        (payload) => {
          console.log('Match period update:', payload);
        }
      )
      .subscribe();

    // Subscribe to player status changes
    const playersChannel = supabase
      .channel(`player-status-${fixtureId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'player_match_status',
          filter: `fixture_id=eq.${fixtureId}`
        },
        (payload) => {
          console.log('Player status update:', payload);
        }
      )
      .subscribe();

    // Check initial tracking status
    const checkInitialStatus = async () => {
      try {
        const { data: fixture, error } = await supabase
          .from('fixtures')
          .select('active_tracker_id, tracking_started_at, match_status, status')
          .eq('id', fixtureId)
          .single();

        if (error) {
          console.error('Error fetching fixture status:', error);
          return;
        }

        // Do not set local tracker if fixture is already completed
        if ((fixture as any)?.match_status === 'completed' || (fixture as any)?.status === 'completed') {
          try {
            if (typeof window !== 'undefined') {
              localStorage.removeItem(`match_${fixtureId}`);
            }
          } catch {}
          setMatchTracker(null);
          return;
        }

        if (fixture?.active_tracker_id) {
          const { data: { user } } = await supabase.auth.getUser();
          const isCurrentUserTracker = user && fixture.active_tracker_id === user.id;
          
          setMatchTracker({
            id: fixtureId,
            isActiveTracker: isCurrentUserTracker || false,
            trackerStartedAt: fixture.tracking_started_at
          });
        }
      } catch (error) {
        console.error('Error checking initial tracking status:', error);
      }
    };

    checkInitialStatus();

    return () => {
      supabase.removeChannel(fixtureChannel);
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(periodsChannel);
      supabase.removeChannel(playersChannel);
    };
  }, [fixtureId, toast, matchTracker?.isActiveTracker]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (matchTracker?.isActiveTracker) {
        releaseMatchTracking();
      }
    };
  }, []);

  return {
    matchTracker,
    claimMatchTracking,
    releaseMatchTracking,
    isClaimingMatch
  };
}