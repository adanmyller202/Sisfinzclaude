import { CurrencyCode, CurrencyConfig, ChallengeGoal, ChallengeSquare } from '../types';

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  ARS: {
    code: 'ARS',
    symbol: '$',
    name: 'Peso Argentino',
    locale: 'es-AR',
    flag: '🇦🇷',
    country: 'Argentina',
  },
  BRL: {
    code: 'BRL',
    symbol: 'R$',
    name: 'Real Brasileiro',
    locale: 'pt-BR',
    flag: '🇧🇷',
    country: 'Brasil',
  },
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    locale: 'en-US',
    flag: '🇺🇸',
    country: 'Estados Unidos',
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    locale: 'de-DE',
    flag: '🇪🇺',
    country: 'União Europeia',
  },
};

/**
 * Intelligently detect user's preferred currency based on browser language/locale
 */
export function detectUserCurrency(): CurrencyCode {
  try {
    const lang = (typeof navigator !== 'undefined' ? navigator.language : '').toLowerCase();
    if (lang.includes('ar') || lang.startsWith('es')) {
      return 'ARS';
    }
    if (lang.startsWith('pt')) {
      return 'BRL';
    }
    if (lang.startsWith('de') || lang.startsWith('fr') || lang.startsWith('it') || lang.includes('europe')) {
      return 'EUR';
    }
    return 'ARS';
  } catch {
    return 'ARS';
  }
}

/**
 * Intelligent starting value suggestions by currency
 */
export const INITIAL_VALUE_SUGGESTIONS: Record<CurrencyCode, number[]> = {
  BRL: [1, 5, 10, 20, 50, 100, 500],
  ARS: [100, 500, 1000, 5000, 10000, 20000, 50000, 100000],
  USD: [1, 5, 10, 20, 50, 100],
  EUR: [1, 5, 10, 20, 50, 100],
};

/**
 * Formats a numeric amount into currency representation
 */
export function formatCurrency(amount: number, currencyCode: CurrencyCode = 'BRL'): string {
  const config = CURRENCIES[currencyCode] || CURRENCIES.BRL;
  try {
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: config.code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${config.symbol} ${amount.toLocaleString(config.locale)}`;
  }
}

/**
 * Formats currency with forced 2 decimal places e.g. R$ 155,00
 */
export function formatCurrencyExact(amount: number, currencyCode: CurrencyCode = 'BRL'): string {
  const config = CURRENCIES[currencyCode] || CURRENCIES.BRL;
  try {
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: config.code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${config.symbol} ${amount.toFixed(2)}`;
  }
}

/**
 * Generates dynamic squares based on target amount and starting value.
 * Progression: S, 2S, 3S, 4S...
 * If the next value exceeds the remaining target, an exact adjustment square is created.
 * Total sum is guaranteed to equal targetAmount.
 */
export function generateDynamicSquares(
  targetAmount: number,
  initialValue: number
): ChallengeSquare[] {
  const target = Math.max(1, Math.round(targetAmount));
  const step = Math.max(1, Math.round(initialValue));

  const squares: ChallengeSquare[] = [];
  let currentSum = 0;
  let multiplier = 1;

  // Safeguard against runaway loops
  const maxSquares = 1500;

  while (currentSum < target && squares.length < maxSquares) {
    const nextVal = multiplier * step;
    const remaining = target - currentSum;

    if (nextVal < remaining) {
      // Normal progression step
      squares.push({
        id: squares.length + 1,
        value: nextVal,
        isAdjustment: false,
      });
      currentSum += nextVal;
      multiplier++;
    } else if (nextVal === remaining) {
      // Perfect match with target
      squares.push({
        id: squares.length + 1,
        value: nextVal,
        isAdjustment: false,
      });
      currentSum += nextVal;
      break;
    } else {
      // nextVal > remaining -> create final adjustment square with exact remaining
      squares.push({
        id: squares.length + 1,
        value: remaining,
        isAdjustment: true,
      });
      currentSum += remaining;
      break;
    }
  }

  return squares;
}

/**
 * Generates squares divided equally across a specified count of squares.
 * Example: Target = 20,000, Count = 20 -> 20 squares of 1,000 each.
 * Example: Target = 20,000, Count = 100 -> 100 squares of 200 each.
 * The total sum is guaranteed to equal targetAmount.
 */
export function generateEqualSquares(
  targetAmount: number,
  squaresCount: number
): ChallengeSquare[] {
  const target = Math.max(1, Math.round(targetAmount));
  const count = Math.max(1, Math.min(1500, Math.round(squaresCount)));

  const baseValue = Math.floor(target / count);
  let remainder = target % count;

  const squares: ChallengeSquare[] = [];
  for (let i = 1; i <= count; i++) {
    const value = baseValue + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
    squares.push({
      id: i,
      value,
      isAdjustment: false,
    });
  }

  return squares;
}

/**
 * Returns the squares of a goal, handling both dynamic new goals and legacy 1..N goals
 */
export function getGoalSquares(goal: ChallengeGoal): ChallengeSquare[] {
  if (goal.squares && goal.squares.length > 0) {
    return goal.squares;
  }

  // Legacy fallback: from startNumber to endNumber
  const start = goal.startNumber || 1;
  const end = goal.endNumber || 200;
  const list: ChallengeSquare[] = [];
  for (let i = start; i <= end; i++) {
    list.push({
      id: i,
      value: i,
      isAdjustment: false,
    });
  }
  return list;
}

/**
 * Calculates saved amount for a goal based on completed square IDs + any avulso deposits
 */
export function getGoalSavedAmount(goal: ChallengeGoal): number {
  const squares = getGoalSquares(goal);
  const valMap = new Map<number, number>();
  for (const s of squares) {
    valMap.set(s.id, s.value);
  }

  const squaresSum = goal.completedSquares.reduce((sum, id) => {
    return sum + (valMap.get(id) || id);
  }, 0);

  const avulsoSum = goal.history
    ? goal.history
        .filter((h) => h.isAvulso)
        .reduce((sum, h) => sum + h.amount, 0)
    : 0;

  return squaresSum + avulsoSum;
}

/**
 * Recalculates all remaining pending squares when an avulso value is deposited.
 * Completed squares are preserved intact with their original values and status.
 * Pending squares are recalculated with the remaining amount so their sum is EXACT.
 */
export function recalculatePendingSquares(
  goal: ChallengeGoal,
  remainingAmount: number
): ChallengeSquare[] {
  const currentSquares = getGoalSquares(goal);
  const completedSquares = currentSquares.filter((s) => goal.completedSquares.includes(s.id));

  if (remainingAmount <= 0) {
    // Goal reached or exceeded, no more pending squares needed
    return completedSquares;
  }

  // Preserve IDs starting after the highest completed ID
  const maxCompletedId =
    completedSquares.length > 0 ? Math.max(...completedSquares.map((s) => s.id)) : 0;

  let newPendingSequence: ChallengeSquare[];

  const isEqualToStart =
    goal.squaresMode === 'equal' ||
    (currentSquares.length > 1 && currentSquares[0].value === currentSquares[1].value);

  if (isEqualToStart) {
    const remainingCount = Math.max(
      1,
      (goal.totalSquares || currentSquares.length) - completedSquares.length
    );
    newPendingSequence = generateEqualSquares(remainingAmount, remainingCount);
  } else {
    // Determine base step: goal's starting amount or previous step
    const step = Math.max(1, goal.startAmount || goal.startNumber || 100);
    newPendingSequence = generateDynamicSquares(remainingAmount, step);
  }

  const newPendingSquares: ChallengeSquare[] = newPendingSequence.map((sq, idx) => ({
    id: maxCompletedId + idx + 1,
    value: sq.value,
    isAdjustment: sq.isAdjustment,
  }));

  return [...completedSquares, ...newPendingSquares];
}

/**
 * Calculate the sum of squares from start to end inclusive (legacy helper)
 */
export function calculateChallengeSum(start: number, end: number): number {
  if (start > end || start < 1) return 0;
  const sumToEnd = (end * (end + 1)) / 2;
  const sumBeforeStart = ((start - 1) * start) / 2;
  return sumToEnd - sumBeforeStart;
}

/**
 * Format date for history e.g. "14/10/2026 às 15:30"
 */
export function formatHistoryDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} às ${hours}:${minutes}`;
  } catch {
    return isoString;
  }
}

export function formatShortDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return isoString;
  }
}
