import { Achievement, ChallengeGoal } from '../types';
import { getGoalSavedAmount } from './currency';

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_square',
    title: 'Primeiro Quadrado',
    description: 'Completou o seu primeiro depósito no desafio!',
    icon: '🏆',
    isUnlocked: (goal: ChallengeGoal) => goal.completedSquares.length >= 1,
  },
  {
    id: 'ten_squares',
    title: '10 Quadrados',
    description: 'Completou 10 quadrados. O hábito está sendo construído!',
    icon: '🔥',
    isUnlocked: (goal: ChallengeGoal) => goal.completedSquares.length >= 10,
  },
  {
    id: 'quarter_way',
    title: '25% Concluído',
    description: 'Economizou um quarto de todo o valor da sua meta!',
    icon: '⭐',
    isUnlocked: (goal: ChallengeGoal) => {
      const saved = getGoalSavedAmount(goal);
      return goal.totalTarget > 0 && (saved / goal.totalTarget) >= 0.25;
    },
  },
  {
    id: 'half_way',
    title: '50% Concluído',
    description: 'Metade do caminho percorrido! O objetivo está ao seu alcance.',
    icon: '💪',
    isUnlocked: (goal: ChallengeGoal) => {
      const saved = getGoalSavedAmount(goal);
      return goal.totalTarget > 0 && (saved / goal.totalTarget) >= 0.50;
    },
  },
  {
    id: 'three_quarters',
    title: '75% Concluído',
    description: 'Reta final! Três quartos do valor total acumulados.',
    icon: '🚀',
    isUnlocked: (goal: ChallengeGoal) => {
      const saved = getGoalSavedAmount(goal);
      return goal.totalTarget > 0 && (saved / goal.totalTarget) >= 0.75;
    },
  },
  {
    id: 'completed_all',
    title: 'Desafio Completo',
    description: 'Parabéns! Todos os quadrados foram completados com sucesso!',
    icon: '🎉',
    isUnlocked: (goal: ChallengeGoal) => {
      return (
        goal.totalSquares > 0 &&
        goal.completedSquares.length >= goal.totalSquares
      );
    },
  },
];
