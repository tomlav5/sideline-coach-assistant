import { supabase } from '@/integrations/supabase/client';

/**
 * Cleans up orphaned match data from localStorage when fixtures are deleted
 */
export async function cleanupOrphanedMatchData(): Promise<void> {
  try {
    const localStorageKeys = Object.keys(localStorage).filter(key => key.startsWith('match_'));
    
    if (localStorageKeys.length === 0) {
      return;
    }

    console.log(`Found ${localStorageKeys.length} match entries in localStorage, checking for orphaned data...`);

    for (const key of localStorageKeys) {
      try {
        const fixtureId = key.replace('match_', '');
        const stored = localStorage.getItem(key);
        
        if (!stored) {
          localStorage.removeItem(key);
          continue;
        }

        // Parse the match data to check timestamps and status
        let matchData;
        try {
          matchData = JSON.parse(stored);
        } catch (parseError) {
          console.log(`Removing corrupted match data: ${key}`);
          localStorage.removeItem(key);
          continue;
        }

        const timeSinceLastSave = Date.now() - matchData.timestamp;
        
        // Remove very old data (over 24 hours)
        if (timeSinceLastSave > 24 * 60 * 60 * 1000) {
          console.log(`Removing old match data (>24h): ${fixtureId}`);
          localStorage.removeItem(key);
          continue;
        }

        // Remove completed matches
        if (matchData.gameState?.matchPhase === 'completed') {
          console.log(`Removing completed match data: ${fixtureId}`);
          localStorage.removeItem(key);
          continue;
        }

        // Check if the fixture still exists in the database
        const { data: fixtureExists, error } = await supabase
          .from('fixtures')
          .select('id')
          .eq('id', fixtureId)
          .maybeSingle();

        if (error) {
          console.error(`Error checking fixture ${fixtureId}:`, error);
          continue;
        }

        if (!fixtureExists) {
          console.log(`Removing orphaned match data for deleted fixture: ${fixtureId}`);
          localStorage.removeItem(key);
        }

      } catch (error) {
        console.error(`Error processing localStorage key ${key}:`, error);
        // If there's any error, remove the problematic entry
        localStorage.removeItem(key);
      }
    }

    console.log('Match data cleanup completed');
  } catch (error) {
    console.error('Error during match data cleanup:', error);
  }
}

/**
 * Schedules periodic cleanup of localStorage
 */
export function scheduleMatchDataCleanup(): void {
  // Run cleanup on page load
  cleanupOrphanedMatchData();
  
  // Schedule periodic cleanup every 30 minutes
  setInterval(() => {
    cleanupOrphanedMatchData();
  }, 30 * 60 * 1000);
}