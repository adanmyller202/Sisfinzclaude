import { AppData, ChallengeGoal } from '../types';
import { calculateChallengeSum } from './currency';
import confetti from 'canvas-confetti';

const STORAGE_KEY = 'money_challenge_app_data_v1';

export const DEFAULT_GOAL: ChallengeGoal = {
  id: 'goal-default-200',
  title: 'Desafio 200 Quadrados',
  icon: '🎯',
  startNumber: 1,
  endNumber: 200,
  totalTarget: calculateChallengeSum(1, 200), // 20100
  totalSquares: 200,
  completedSquares: [],
  history: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  notes: 'Meta inicial de R$ 20.100 economizando de 1 a 200',
};

export const INITIAL_APP_DATA: AppData = {
  goals: [],
  activeGoalId: '',
  settings: {
    currency: 'BRL',
    darkMode: false,
    soundEnabled: true,
  },
  unlockedAchievements: [],
};

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Check system color preference
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initial = {
        ...INITIAL_APP_DATA,
        settings: {
          ...INITIAL_APP_DATA.settings,
          darkMode: prefersDark,
        },
      };
      saveAppData(initial);
      return initial;
    }
    const parsed = JSON.parse(raw) as AppData;
    // Ensure all required fields exist
    if (!parsed.goals || !Array.isArray(parsed.goals)) {
      parsed.goals = [];
    }
    if (!parsed.activeGoalId || !parsed.goals.some(g => g.id === parsed.activeGoalId)) {
      parsed.activeGoalId = parsed.goals.length > 0 ? parsed.goals[0].id : '';
    }
    if (!parsed.settings) {
      parsed.settings = INITIAL_APP_DATA.settings;
    }
    if (!parsed.unlockedAchievements) {
      parsed.unlockedAchievements = [];
    }
    return parsed;
  } catch (error) {
    console.error('Error loading app data from localStorage:', error);
    return INITIAL_APP_DATA;
  }
}

export function saveAppData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving app data to localStorage:', error);
  }
}

/**
 * Fires celebration confetti
 */
export function triggerCelebration(mode: 'small' | 'major' = 'small') {
  try {
    if (mode === 'major') {
      const end = Date.now() + 3000;
      const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'];

      (function frame() {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors,
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors,
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      })();
    } else {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#10b981', '#059669', '#34d399', '#6ee7b7', '#f59e0b'],
      });
    }
  } catch (e) {
    console.error('Confetti trigger failed:', e);
  }
}

/**
 * Plays a pleasant synthesizer chime using Web Audio API
 */
export function playSuccessChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1); // E5
    osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.2); // G5
    osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.3); // C6

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.45);
  } catch {
    // Audio might be blocked until user gesture, safely ignore
  }
}
