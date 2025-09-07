import { useEffect } from 'react';

interface MatchStorageData {
  fixture: any;
  matchState: any;
  gameState: any;
  startTimes: any;
  timestamp: number;
}

export function useMatchStorage(fixtureId: string | undefined) {
  const saveMatchStateToStorage = (data: Omit<MatchStorageData, 'timestamp'>) => {
    if (!fixtureId) return;
    
    const matchData = {
      ...data,
      timestamp: Date.now(),
    };
    
    localStorage.setItem(`match_${fixtureId}`, JSON.stringify(matchData));
  };

  const recoverMatchState = (): MatchStorageData | null => {
    if (!fixtureId) return null;
    
    const stored = localStorage.getItem(`match_${fixtureId}`);
    if (!stored) return null;
    
    try {
      const matchData = JSON.parse(stored);
      const timeSinceLastSave = Date.now() - matchData.timestamp;
      
      // Only recover if less than 12 hours old and not completed
      if (timeSinceLastSave < 12 * 60 * 60 * 1000 && matchData.gameState?.matchPhase !== 'completed') {
        return matchData;
      }
    } catch (error) {
      console.error('Error recovering match state:', error);
    }
    
    return null;
  };

  const clearMatchFromStorage = () => {
    if (fixtureId) {
      localStorage.removeItem(`match_${fixtureId}`);
    }
  };

  // Clear expired match data on app load
  const clearExpiredMatches = () => {
    if (typeof window === 'undefined') return;
    
    const keys = Object.keys(localStorage);
    const matchKeys = keys.filter(key => key.startsWith('match_'));
    
    matchKeys.forEach(key => {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '{}');
        const timeSinceLastSave = Date.now() - (data.timestamp || 0);
        
        // Clear if older than 12 hours or completed
        if (timeSinceLastSave > 12 * 60 * 60 * 1000 || data.gameState?.matchPhase === 'completed') {
          localStorage.removeItem(key);
        }
      } catch (error) {
        console.error('Error clearing expired match data:', error);
        localStorage.removeItem(key);
      }
    });
  };

  return {
    saveMatchStateToStorage,
    recoverMatchState,
    clearMatchFromStorage,
    clearExpiredMatches,
  };
}