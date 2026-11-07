/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MoneMood } from '../types';

export interface MoneMoodInput {
  forecastBalance: number;
  currentBalance: number;
  overdueCount: number;
  isOnline?: boolean;
  hasData?: boolean;
}

export interface MoneMoodResult {
  mood: MoneMood;
  moodLabelKey: 'moneMoodSleeping' | 'moneMoodScared' | 'moneMoodWorried' | 'moneMoodHappy' | 'moneMoodCalm';
}

/**
 * Pure function determining Mone's emotional state based on real financial context.
 * Rules:
 * - 'sleeping': if !hasData (no bills, expenses, or incomes)
 * - 'scared': if forecastBalance < 0
 * - 'worried': if overdueCount > 0
 * - 'happy': if forecastBalance > currentBalance && currentBalance >= 0
 * - 'calm': default / neutral
 */
export function getMoneMood(input: MoneMoodInput): MoneMoodResult {
  const { forecastBalance, currentBalance, overdueCount, hasData = true } = input;

  if (!hasData) {
    return { mood: 'sleeping', moodLabelKey: 'moneMoodSleeping' };
  }

  if (forecastBalance < 0) {
    return { mood: 'scared', moodLabelKey: 'moneMoodScared' };
  }

  if (overdueCount > 0) {
    return { mood: 'worried', moodLabelKey: 'moneMoodWorried' };
  }

  if (forecastBalance > currentBalance && currentBalance >= 0) {
    return { mood: 'happy', moodLabelKey: 'moneMoodHappy' };
  }

  return { mood: 'calm', moodLabelKey: 'moneMoodCalm' };
}
