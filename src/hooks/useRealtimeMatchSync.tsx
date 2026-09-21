import { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { deriveTrackerHolder } from '@/lib/trackerGate';

export interface MatchTracker {
  id: string;
  isActiveTracker: boolean;
  trackerStartedAt?: string;
}

export function useRealtimeMatchSync(fixtureId: string | undefined) {
  const [matchTracker, setMatchTracker] = useState<MatchTracker | null>(null);
  const [isClaimingMatch, setIsClaimingMatch] = useState(false);
  // The fixture whose active_tracker_id this client has actually read. `matchTracker`
  // null cannot say "nobody holds it" on its own — it is also the value before the
  // first read and after a failed one — so the tracker gate only trusts null once this
  // matches the current fixture. Keyed by fixture id (not a boolean) so a change of
  // fixtureId is unresolved again without needing a reset.
  const [resolvedFixtureId, setResolvedFixtureId] = useState<string | null>(null);
  // Persistent (not a toast) message shown when this client discovers, via the
  // fixtures realtime payload, that someone else now holds active_tracker_id.
  // Cleared once this client is the tracker again — either by reclaiming here
  // or by a payload reporting it as the tracker (see the fixtureChannel handler).
  const [displacedNotice, setDisplacedNotice] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Last-known active_tracker_id and current user id, kept in refs so the
  // realtime handler below can tell "identity changed" from "same tracker,
  // heartbeat touched last_activity_at" without an extra fetch per event.
  const activeTrackerIdRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      currentUserIdRef.current = user?.id ?? null;
    });
  }, []);

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
        // The server has just said who holds the match: someone else, active in the last
        // 5 minutes (it only refuses when the holder is not the caller). Bring local state
        // in line, otherwise a refused Start Period leaves an enabled button and an
        // "available for tracking" banner beside the very refusal that contradicts them.
        if (result.current_tracker) {
          activeTrackerIdRef.current = result.current_tracker;
          setMatchTracker({
            id: fixtureId,
            isActiveTracker: false,
            trackerStartedAt: result.tracking_started_at
          });
        }
        return false;
      }

      toast({
        title: "Match Tracking Claimed",
        description: "You are now the active match tracker",
      });

      activeTrackerIdRef.current = currentUserIdRef.current;
      setMatchTracker({
        id: fixtureId,
        isActiveTracker: true,
        trackerStartedAt: result.tracking_started_at
      });
      setDisplacedNotice(null);

      queryClient.invalidateQueries({ queryKey: ['live-match-detection'] });

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
  }, [fixtureId, toast, queryClient]);

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

      activeTrackerIdRef.current = null;
      setMatchTracker(null);
      setDisplacedNotice(null);
      toast({
        title: "Match Tracking Released",
        description: "You are no longer the active tracker",
      });

      queryClient.invalidateQueries({ queryKey: ['live-match-detection'] });
    } catch (error) {
      console.error('Error releasing match tracking:', error);
    }
  }, [fixtureId, toast, queryClient]);

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
          if (payload.eventType !== 'UPDATE') return;
          const newData = payload.new as any;

          // If fixture completed, clear local tracker and localStorage
          if (newData.match_status === 'completed' || newData.status === 'completed') {
            try {
              if (typeof window !== 'undefined') {
                localStorage.removeItem(`match_${fixtureId}`);
              }
            } catch {}
            activeTrackerIdRef.current = null;
            setMatchTracker(null);
            setDisplacedNotice(null);
            toast({ title: 'Match completed', description: 'Live tracking session ended.' });
            return;
          }

          const newTrackerId: string | null = newData.active_tracker_id ?? null;
          const previousTrackerId = activeTrackerIdRef.current;

          // The heartbeat writes last_activity_at to fixtures every 30s per
          // active tracker (useRealtimeMatchSync's own interval below), so this
          // handler fires roughly every 30s during a tracked match, plus once
          // per claim/release. Only react when the tracker identity itself has
          // changed — otherwise every heartbeat would churn matchTracker state
          // (and everything keyed on it) for no reason (BUG-008 was this same
          // failure shape: something firing far more often than intended).
          if (newTrackerId === previousTrackerId) return;
          activeTrackerIdRef.current = newTrackerId;

          if (!newTrackerId) {
            // Tracking released — nobody holds it now. Not a "someone else took
            // over" event, so no displaced notice.
            setMatchTracker(null);
            return;
          }

          const currentUserId = currentUserIdRef.current;
          const isCurrentUserTracker = !!currentUserId && newTrackerId === currentUserId;

          setMatchTracker({
            id: fixtureId,
            isActiveTracker: isCurrentUserTracker,
            trackerStartedAt: newData.tracking_started_at,
          });

          if (isCurrentUserTracker) {
            setDisplacedNotice(null);
          } else if (previousTrackerId === currentUserId) {
            // We were the tracker a moment ago and someone else just claimed it.
            // Persistent, not a toast — see BUG-013/SEC-003: a coach must not
            // keep tapping a screen that has silently stopped recording.
            setDisplacedNotice(
              'Someone else has taken over tracking this match. Your changes are no longer being recorded.'
            );
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
          setResolvedFixtureId(fixtureId);
          return;
        }

        activeTrackerIdRef.current = fixture?.active_tracker_id ?? null;

        if (fixture?.active_tracker_id) {
          const { data: { user } } = await supabase.auth.getUser();
          currentUserIdRef.current = user?.id ?? null;
          const isCurrentUserTracker = user && fixture.active_tracker_id === user.id;

          setMatchTracker({
            id: fixtureId,
            isActiveTracker: isCurrentUserTracker || false,
            trackerStartedAt: fixture.tracking_started_at
          });
        }
        // Reached only on a successful read (both error paths above return / throw
        // before here), so a null matchTracker now genuinely means active_tracker_id
        // IS NULL. Set after the getUser await so it lands in the same batch as
        // setMatchTracker — never "resolved" while the holder is still being worked out.
        setResolvedFixtureId(fixtureId);
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
    // matchTracker is deliberately not a dependency — the handler above reads
    // tracker identity from refs, not from closure state, so this subscription
    // does not need to be torn down and recreated on every tracker change.
  }, [fixtureId, toast]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (matchTracker?.isActiveTracker) {
        releaseMatchTracking();
      }
    };
  }, []);

  // Who holds the match, with "not known yet" kept distinct from "nobody" — the value
  // the control gate reads (see lib/trackerGate.ts). matchTracker itself is unchanged.
  const trackerHolder = deriveTrackerHolder(
    !!fixtureId && resolvedFixtureId === fixtureId,
    matchTracker,
  );

  return {
    matchTracker,
    trackerHolder,
    claimMatchTracking,
    releaseMatchTracking,
    isClaimingMatch,
    displacedNotice
  };
}