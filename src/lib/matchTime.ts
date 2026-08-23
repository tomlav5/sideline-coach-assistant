export interface MatchPeriod {
  id: string;
  fixture_id: string;
  period_number: number;
  period_type: 'period' | 'penalties';
  planned_duration_minutes: number;
  actual_start_time?: string;
  actual_end_time?: string;
  is_active: boolean;
  pause_time?: string;
  total_paused_seconds: number;
}

export const calculateCurrentPeriodTime = (period?: MatchPeriod, now: number = Date.now()): number => {
  if (!period?.actual_start_time) return 0;

  const startTime = new Date(period.actual_start_time).getTime();
  const pausedSeconds = period.total_paused_seconds || 0;

  if (period.pause_time && !period.is_active) {
    // Currently paused
    const pauseStart = new Date(period.pause_time).getTime();
    return Math.floor((pauseStart - startTime) / 1000) - pausedSeconds;
  }

  if (period.actual_end_time) {
    // Period ended
    const endTime = new Date(period.actual_end_time).getTime();
    return Math.floor((endTime - startTime) / 1000) - pausedSeconds;
  }

  // Currently running
  return Math.floor((now - startTime) / 1000) - pausedSeconds;
};

export const calculateTotalMatchTime = (
  periods: MatchPeriod[],
  currentPeriodId: string | undefined,
  currentPeriodSeconds: number,
): number => {
  return (periods || []).reduce((sum, p) => {
    if (p.actual_end_time) {
      const start = new Date(p.actual_start_time!).getTime();
      const end = new Date(p.actual_end_time).getTime();
      const elapsed = Math.floor((end - start) / 1000) - (p.total_paused_seconds || 0);
      return sum + Math.max(0, elapsed);
    }
    if (currentPeriodId && p.id === currentPeriodId) {
      return sum + Math.max(0, currentPeriodSeconds);
    }
    return sum;
  }, 0);
};
