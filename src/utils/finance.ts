/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RecurrenceType } from '../types';

/**
 * Returns the current month in YYYY-MM format
 */
export function getCurrentMonthStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Returns today's date in YYYY-MM-DD format
 */
export function getTodayStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Adds or subtracts months from a 'YYYY-MM' string
 */
export function shiftMonthStr(monthStr: string, delta: number): string {
  const parts = (monthStr || '').split('-');
  if (parts.length < 2) return monthStr;
  const [yearStr, mStr] = parts;
  const date = new Date(parseInt(yearStr, 10), parseInt(mStr, 10) - 1 + delta, 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Formats YYYY-MM into a localized title, e.g. "Outubro 2026"
 */
export function formatMonthName(monthStr: string, locale: string = 'pt-BR'): string {
  const parts = (monthStr || '').split('-');
  if (parts.length < 2) return monthStr;
  const [yearStr, mStr] = parts;
  const date = new Date(parseInt(yearStr, 10), parseInt(mStr, 10) - 1, 1);
  const monthName = date.toLocaleDateString(locale, { month: 'long' });
  const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  return `${capitalized} de ${date.getFullYear()}`;
}

/**
 * Short month label, e.g. "Outubro"
 */
export function getShortMonthLabel(monthStr: string, locale: string = 'pt-BR'): string {
  const parts = (monthStr || '').split('-');
  if (parts.length < 2) return monthStr;
  const [yearStr, mStr] = parts;
  const date = new Date(parseInt(yearStr, 10), parseInt(mStr, 10) - 1, 1);
  const monthName = date.toLocaleDateString(locale, { month: 'short' }).replace('.', '').toUpperCase();
  return monthName;
}

/**
 * Formats YYYY-MM-DD into "05 OUT"
 */
export function formatDayMonthLabel(dateStr: string, locale: string = 'pt-BR'): string {
  const parts = (dateStr || '').split('-');
  if (parts.length < 3) return dateStr || '';
  const day = parts[2];
  const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  const monthShort = date.toLocaleDateString(locale, { month: 'short' }).replace('.', '').toUpperCase();
  return `${day} ${monthShort}`;
}

/**
 * Calculates month difference (monthB - monthA)
 */
export function getMonthDiff(startMonthStr: string, targetMonthStr: string): number {
  const p1 = (startMonthStr || '').split('-');
  const p2 = (targetMonthStr || '').split('-');
  if (p1.length < 2 || p2.length < 2) return 0;
  const [y1, m1] = p1.map(Number);
  const [y2, m2] = p2.map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

/**
 * Checks if a recurring or non-recurring item occurs in targetMonth
 */
export function doesItemOccurInMonth(
  startMonthStr: string,
  targetMonthStr: string,
  recurrence: RecurrenceType,
  recurrenceMonthsCount?: number
): boolean {
  const diff = getMonthDiff(startMonthStr, targetMonthStr);
  if (diff < 0) return false;

  if (recurrence === 'none') {
    return diff === 0;
  }

  // recurrence === 'monthly'
  if (!recurrenceMonthsCount || recurrenceMonthsCount <= 0) {
    return true; // repeat forever
  }

  return diff < recurrenceMonthsCount;
}

/**
 * Returns formatted installment label (e.g. "Parcela 3/8")
 */
export function getInstallmentPosition(
  startMonthStr: string,
  targetMonthStr: string,
  recurrence: RecurrenceType,
  recurrenceMonthsCount?: number,
  language: 'pt' | 'es' | 'en' = 'pt'
): string | null {
  if (recurrence !== 'monthly' || !recurrenceMonthsCount || recurrenceMonthsCount <= 1) {
    return null;
  }
  const diff = getMonthDiff(startMonthStr, targetMonthStr);
  if (diff < 0 || diff >= recurrenceMonthsCount) {
    return null;
  }
  const current = diff + 1;
  const total = recurrenceMonthsCount;
  if (language === 'es') {
    return `Cuota ${current}/${total}`;
  }
  if (language === 'en') {
    return `Installment ${current}/${total}`;
  }
  return `Parcela ${current}/${total}`;
}

/**
 * Returns effective YYYY-MM-DD for a given target month and target day of month
 */
export function getEffectiveDateForMonth(targetMonthStr: string, dayOfMonth: number): string {
  const parts = (targetMonthStr || '').split('-');
  if (parts.length < 2) return targetMonthStr || '';
  const [yearStr, mStr] = parts;
  const year = parseInt(yearStr, 10);
  const monthIndex = parseInt(mStr, 10) - 1;
  const maxDays = new Date(year, monthIndex + 1, 0).getDate();
  const clampedDay = Math.min(Math.max(1, dayOfMonth), maxDays);
  return `${yearStr}-${mStr}-${String(clampedDay).padStart(2, '0')}`;
}

/**
 * Categories with distinct styling and icons
 */
export const BILL_CATEGORIES = [
  'Moradia',
  'Alimentação',
  'Saúde',
  'Transporte',
  'Educação',
  'Assinaturas & Serviços',
  'Lazer & Estilo de Vida',
  'Cartão de Crédito',
  'Impostos & Taxas',
  'Outros',
] as const;

export const INCOME_CATEGORIES = [
  'Salário',
  'Freelance',
  'Vendas',
  'Investimentos',
  'Benefícios',
  'Bônus / PLR',
  'Renda Extra',
  'Outros',
] as const;

export const EXPENSE_CATEGORIES = [
  'Inversiones',
  'Alimentação & Restaurantes',
  'Mercado & Compras',
  'Lazer & Entretenimento',
  'Transporte & Combustível',
  'Saúde & Farmácia',
  'Vestuário & Cuidados',
  'Casa & Utilidades',
  'Imprevistos',
  'Outros',
] as const;
