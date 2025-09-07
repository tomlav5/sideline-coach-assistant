import { useState, useEffect, useRef } from 'react';

interface TimerState {
  currentHalf: 'first' | 'second';
  isRunning: boolean;
  firstHalfTime: number;
  secondHalfTime: number;
  matchPhase: 'pre-match' | 'first-half' | 'half-time' | 'second-half' | 'completed';
}

interface UseMatchTimerProps {
  halfLength: number;
  onSaveState?: () => void;
}

export function useMatchTimer({ halfLength, onSaveState }: UseMatchTimerProps) {
  const [timerState, setTimerState] = useState<TimerState>({
    currentHalf: 'first',
    isRunning: false,
    firstHalfTime: 0,
    secondHalfTime: 0,
    matchPhase: 'pre-match',
  });

  const intervalRef = useRef<NodeJS.Timeout>();
  
  const [startTimes, setStartTimes] = useState({
    matchStart: 0,
    firstHalfStart: 0,
    secondHalfStart: 0,
  });

  useEffect(() => {
    if (timerState.isRunning) {
      // Store the actual start time instead of relying on setInterval
      const startTime = Date.now();
      const currentSeconds = timerState.currentHalf === 'first' 
        ? timerState.firstHalfTime 
        : timerState.secondHalfTime;
      
      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        
        setTimerState(prev => {
          const newState = { ...prev };
          if (newState.currentHalf === 'first') {
            newState.firstHalfTime = currentSeconds + elapsed;
          } else {
            newState.secondHalfTime = currentSeconds + elapsed;
          }
          return newState;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timerState.isRunning, timerState.currentHalf]);

  const startMatch = () => {
    const newStartTimes = { ...startTimes };
    newStartTimes.matchStart = Date.now();
    newStartTimes.firstHalfStart = Date.now();
    setStartTimes(newStartTimes);

    setTimerState(prev => ({
      ...prev,
      isRunning: true,
      matchPhase: 'first-half',
    }));

    onSaveState?.();
  };

  const toggleTimer = () => {
    setTimerState(prev => ({
      ...prev,
      isRunning: !prev.isRunning,
    }));
    onSaveState?.();
  };

  const endFirstHalf = () => {
    setTimerState(prev => ({
      ...prev,
      isRunning: false,
      matchPhase: 'half-time',
    }));
    onSaveState?.();
  };

  const startSecondHalf = () => {
    const newStartTimes = { ...startTimes };
    newStartTimes.secondHalfStart = Date.now();
    setStartTimes(newStartTimes);

    setTimerState(prev => ({
      ...prev,
      currentHalf: 'second',
      isRunning: true,
      matchPhase: 'second-half',
      secondHalfTime: 0,
    }));
    onSaveState?.();
  };

  const endMatch = () => {
    setTimerState(prev => ({
      ...prev,
      isRunning: false,
      matchPhase: 'completed',
    }));
    onSaveState?.();
  };

  const getCurrentTime = () => {
    return timerState.currentHalf === 'first' 
      ? timerState.firstHalfTime 
      : timerState.secondHalfTime;
  };

  const getCurrentMinute = () => {
    return Math.floor(getCurrentTime() / 60);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    timerState,
    setTimerState,
    startTimes,
    setStartTimes,
    startMatch,
    toggleTimer,
    endFirstHalf,
    startSecondHalf,
    endMatch,
    getCurrentTime,
    getCurrentMinute,
    formatTime,
  };
}