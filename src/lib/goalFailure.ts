// The toast shown when recording a goal from the match screen fails.
//
// Raised by EnhancedMatchTracker.handleQuickGoal, which has the error detail and
// sits behind every QuickGoalButton path (ordinary, opponent and own goal). It
// re-throws afterwards so the dialog stays open with the coach's selections
// intact, ready to retry. Before this, failures only reached console.error and
// the Confirm button looked dead.

// Supabase errors are plain objects with a message, not Error instances.
const errorDetail = (error: unknown): string =>
  (error as { message?: string } | null)?.message || 'Unknown error';

export const goalFailureToast = (error: unknown) => ({
  title: 'Goal not recorded',
  description: `${errorDetail(error)}. Nothing was saved — your selection is still there, so you can try again.`,
  variant: 'destructive' as const,
});
