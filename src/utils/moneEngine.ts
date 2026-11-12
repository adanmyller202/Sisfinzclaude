/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import { auth } from '../firebase/config';
import {
  BillItem,
  AccountItem,
  AccountType,
  IncomeItem,
  ExpenseItem,
  ChallengeGoal,
  MonthlyStatusRecord,
  CurrencyCode,
  LanguageCode,
  RecurrenceType,
  MoneStyle,
  SharedBill,
  FiftyTwoWeekChallenge,
  SavingGoal,
  SavingTransaction,
  SplitMethod,
} from '../types';
import {
  getCurrentMonthStr,
  getTodayStr,
  shiftMonthStr,
  formatMonthName,
  doesItemOccurInMonth,
  getEffectiveDateForMonth,
} from './finance';
import { formatCurrencySpoken } from './currency';
import { getLocaleForLanguage } from './i18n';

export type MoneNavigationSection =
  | 'finance' | 'planejar' | 'goals' | 'savings' | 'categories' | 'report'
  | 'shared_accounts' | 'challenge_52' | 'full_report' | 'accounts'
  | 'financial_calendar' | 'freedom' | 'daily_pace';

export interface MoneActionItem {
  type: 'expense' | 'bill' | 'income';
  id: string;
  name: string;
  amount: number;
}

export interface MoneActionHandlers {
  onAddExpense?: (expenseData: Omit<ExpenseItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<any> | void;
  onUpdateExpense?: (expenseId: string, partial: Partial<ExpenseItem>) => Promise<any> | void;
  onDeleteExpense?: (expenseId: string) => Promise<any> | void;
  onAddBill?: (billData: Omit<BillItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<any> | void;
  onUpdateBill?: (billId: string, partial: Partial<BillItem>) => Promise<any> | void;
  onDeleteBill?: (billId: string) => Promise<any> | void;
  onToggleBillPaid?: (billId: string, month: string, isPaid: boolean) => Promise<any> | void;
  onAddIncome?: (incomeData: Omit<IncomeItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<any> | void;
  onAddIncomeAsReceived?: (
    incomeData: Omit<IncomeItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
    receivedMonth: string
  ) => Promise<any> | void;
  onUpdateIncome?: (incomeId: string, partial: Partial<IncomeItem>) => Promise<any> | void;
  onDeleteIncome?: (incomeId: string) => Promise<any> | void;
  onToggleIncomeReceived?: (incomeId: string, month: string, isReceived: boolean) => Promise<any> | void;
  onUpdateCurrentBalance?: (newBalance: number) => Promise<any> | void;
  onCreateGoal?: (goalData: {
    title: string;
    icon: string;
    targetAmount: number;
    initialValue: number;
    currency: CurrencyCode;
    notes?: string;
  }) => Promise<any> | void;
  onUpdateGoal?: (goalId: string, partial: { title?: string; icon?: string; notes?: string }) => Promise<any> | void;
  onDeleteGoal?: (goalId: string) => Promise<any> | void;
  onTransferBetweenAccounts?: (params: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    date: string;
    notes?: string;
  }) => Promise<any> | void;
  onToggleMySharePaid?: (billId: string, isPaid: boolean, targetMonth?: string) => Promise<any> | void;
  onCompleteChallengeWeek?: (challengeId: string, weekNumber: number, accountId: string) => Promise<any> | void;
  onUndoChallengeWeek?: (challengeId: string, weekNumber: number, returnAccountId: string) => Promise<any> | void;
  onNavigateToSection?: (section: MoneNavigationSection) => Promise<void> | void;
  onViewForecastMonth?: (month: string) => Promise<void> | void;
  onCreateSavingGoal?: (params: {
    name: string; hasTarget?: boolean; targetAmount?: number; currency?: CurrencyCode;
    deadline?: string; icon?: string; notes?: string;
  }) => Promise<any> | void;
  onUpdateSavingGoal?: (savingId: string, updates: Partial<SavingGoal>) => Promise<any> | void;
  onDeleteSavingGoal?: (savingId: string) => Promise<any> | void;
  onTransferToSaving?: (savingId: string, amount: number, exchangeRate?: number, date?: string, note?: string) => Promise<any> | void;
  onWithdrawFromSaving?: (savingId: string, amount: number, exchangeRate?: number, date?: string, note?: string) => Promise<any> | void;
  onAddCategory?: (name: string, scope: 'all' | 'bill' | 'income' | 'expense') => Promise<any> | void;
  onUpdateCategory?: (categoryId: string, updates: { name?: string; scope?: 'all' | 'bill' | 'income' | 'expense'; color?: string }) => Promise<any> | void;
  onDeleteCategory?: (categoryId: string) => Promise<any> | void;
  onAddAccount?: (params: { name: string; type: AccountType; currency: CurrencyCode; initialBalance: number; currentBalance?: number; notes?: string }) => Promise<any> | void;
  onUpdateAccount?: (accountId: string, params: Partial<AccountItem> & { currentBalance?: number }) => Promise<any> | void;
  onDeleteAccount?: (accountId: string) => Promise<any> | void;
  onToggleAccountActive?: (accountId: string) => Promise<any> | void;
  onCreateSharedBill?: (params: {
    title: string; amount: number; dueDate: string; dueDay: number; category: string; notes?: string;
    partnerId: string; splitMethod: SplitMethod; myPercentage: number; partnerPercentage: number;
    recurrence?: 'none' | 'monthly'; recurrenceMonthsCount?: number;
  }) => Promise<any> | void;
  onUpdateSharedBill?: (billId: string, updates: {
    title: string; amount: number; dueDate: string; dueDay: number; category: string; notes?: string;
    splitMethod: SplitMethod; myPercentage: number; partnerPercentage: number;
  }) => Promise<any> | void;
  onDeleteSharedBill?: (billId: string) => Promise<any> | void;
}

export interface MoneContext {
  currentBalance: number;
  forecastBalance?: number;
  accounts?: AccountItem[];
  sharedBills?: SharedBill[];
  sharedPartners?: Array<{ uid: string; displayName: string; email?: string }>;
  weeklyChallenges?: FiftyTwoWeekChallenge[];
  myUserId?: string;
  bills: BillItem[];
  incomes: IncomeItem[];
  expenses: ExpenseItem[];
  statusRecords: MonthlyStatusRecord[];
  goals: ChallengeGoal[];
  savings?: SavingGoal[];
  savingTransactions?: SavingTransaction[];
  categories?: Array<{ id: string; name: string; scope: string; isPredefined?: boolean }>;
  currency: CurrencyCode;
  language: LanguageCode;
  lastActionItem?: MoneActionItem | null;
  history?: { sender: 'user' | 'mone'; text: string }[];
  handlers?: MoneActionHandlers;
  persona?: string;
}

export interface MoneResponse {
  text: string;
  isInternalCalculation?: boolean;
  actionExecuted?: string;
  createdItem?: MoneActionItem | null;
}

// Month name dictionary across languages
const MONTH_NAMES_MAP: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  março: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
  enero: 1,
  febrero: 2,
  marzo: 3,
  mayo: 5,
  junio: 6,
  julio: 7,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Extracts a target month (YYYY-MM) from natural user queries
 */
export function extractTargetMonth(text: string, currentMonthStr: string): string {
  const norm = normalize(text);
  const currentYear = parseInt(currentMonthStr.split('-')[0], 10);
  const currentMonthNum = parseInt(currentMonthStr.split('-')[1], 10);

  if (
    norm.includes('este mes') ||
    norm.includes('mes atual') ||
    norm.includes('this month') ||
    norm.includes('current month')
  ) {
    return currentMonthStr;
  }

  if (
    norm.includes('proximo mes') ||
    norm.includes('mes que vem') ||
    norm.includes('next month')
  ) {
    return shiftMonthStr(currentMonthStr, 1);
  }

  if (
    norm.includes('mes passado') ||
    norm.includes('mes anterior') ||
    norm.includes('last month')
  ) {
    return shiftMonthStr(currentMonthStr, -1);
  }

  const yearMatch = norm.match(/\b(202\d)\b/);
  const explicitYear = yearMatch ? parseInt(yearMatch[1], 10) : null;

  for (const [mName, mNum] of Object.entries(MONTH_NAMES_MAP)) {
    const reg = new RegExp(`\\b${mName}\\b`, 'i');
    if (reg.test(norm)) {
      let year = explicitYear;
      if (!year) {
        year = mNum < currentMonthNum ? currentYear + 1 : currentYear;
      }
      return `${year}-${String(mNum).padStart(2, '0')}`;
    }
  }

  return currentMonthStr;
}

/**
 * Parses numeric currency values from text:
 * handles "50 mil" -> 50000, "200 mil" -> 200000, "2500 pesos", "$4.000", "40k"
 */
function parseAmountFromText(text: string): number | null {
  const norm = normalize(text);

  // Handle "X mil" or "X k"
  const milMatch = norm.match(/(\d+(?:[.,]\d+)?)\s*(?:mil|k\b)/i);
  if (milMatch) {
    const base = parseFloat(milMatch[1].replace(',', '.'));
    return isNaN(base) ? null : base * 1000;
  }

  // Handle "X milhões" or "X mi"
  const miMatch = norm.match(/(\d+(?:[.,]\d+)?)\s*(?:milh[oõ]es|mi\b)/i);
  if (miMatch) {
    const base = parseFloat(miMatch[1].replace(',', '.'));
    return isNaN(base) ? null : base * 1000000;
  }

  // General formatted number e.g. "200.000" or "2,500.00" or "2500"
  const cleanMatches = text.match(/(?:[$R€]\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?)/g);
  if (cleanMatches) {
    for (const raw of cleanMatches) {
      const clean = raw.replace(/[$R€\s]/g, '');
      if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(clean)) {
        return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
      }
      if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(clean)) {
        return parseFloat(clean.replace(/,/g, ''));
      }
      const val = parseFloat(clean.replace(',', '.'));
      if (!isNaN(val)) return val;
    }
  }

  return null;
}

/**
 * Formats a clean number output
 */
function formatNumberOutput(value: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
}

/**
 * Solves direct arithmetic queries like "Quanto é 50.000 + 50.000?"
 */
function trySolveMath(question: string): string | null {
  const norm = normalize(question)
    .replace(/^quanto e\s+/i, '')
    .replace(/^cuanto es\s+/i, '')
    .replace(/^what is\s+/i, '')
    .replace(/\?/g, '')
    .trim();

  const mathRegex = /^([\d\.,]+)\s*([\+\-\*\/xX])\s*([\d\.,]+)(?:\s*([\+\-\*\/xX])\s*([\d\.,]+))?$/;
  const match = norm.match(mathRegex);

  if (match) {
    try {
      const parseVal = (str: string) => {
        const cleaned = str.trim();
        if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
          return parseFloat(cleaned.replace(/\./g, ''));
        }
        return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
      };

      const val1 = parseVal(match[1]);
      const op1 = match[2].toLowerCase() === 'x' ? '*' : match[2];
      const val2 = parseVal(match[3]);

      if (isNaN(val1) || isNaN(val2)) return null;

      let result = 0;
      switch (op1) {
        case '+':
          result = val1 + val2;
          break;
        case '-':
          result = val1 - val2;
          break;
        case '*':
          result = val1 * val2;
          break;
        case '/':
          result = val2 !== 0 ? val1 / val2 : 0;
          break;
        default:
          return null;
      }

      if (match[4] && match[5]) {
        const op2 = match[4].toLowerCase() === 'x' ? '*' : match[4];
        const val3 = parseVal(match[5]);
        if (!isNaN(val3)) {
          if (op2 === '+') result += val3;
          else if (op2 === '-') result -= val3;
          else if (op2 === '*') result *= val3;
          else if (op2 === '/' && val3 !== 0) result /= val3;
        }
      }

      return `${formatNumberOutput(result)}.`;
    } catch {
      return null;
    }
  }

  return null;
}

function getCurrentBalancesByCurrency(context: MoneContext): Map<CurrencyCode, number> {
  const totals = new Map<CurrencyCode, number>();
  const activeAccounts = (context.accounts || []).filter((account) => account.isActive !== false);
  if (activeAccounts.length) {
    for (const account of activeAccounts) {
      const amount = Number(account.currentBalance ?? (account as any).balance ?? account.initialBalance ?? 0) || 0;
      totals.set(account.currency, (totals.get(account.currency) || 0) + amount);
    }
  } else {
    totals.set(context.currency, Number(context.currentBalance) || 0);
  }
  return totals;
}

function formatCurrencyBreakdown(totals: Map<CurrencyCode, number>, emptyText = 'nenhum valor previsto'): string {
  const parts = [...totals.entries()]
    .filter(([, amount]) => Number.isFinite(amount))
    .map(([code, amount]) => formatCurrencySpoken(amount, code));
  return parts.length ? parts.join(' + ') : emptyText;
}

function resolveMoneAccount(
  context: MoneContext,
  accountId?: string,
  accountName?: string
): { account?: AccountItem; needsChoice: boolean } {
  const active = (context.accounts || []).filter((account) => account.isActive !== false);
  if (!active.length) return { needsChoice: false };
  if (accountId) {
    const byId = active.find((account) => account.id === accountId);
    return byId ? { account: byId, needsChoice: false } : { needsChoice: true };
  }
  const target = normalize(accountName || '');
  if (target) {
    const matches = active.filter((account) => {
      const name = normalize(account.name);
      return name === target || name.includes(target) || target.includes(name);
    });
    return matches.length === 1 ? { account: matches[0], needsChoice: false } : { needsChoice: true };
  }
  return active.length === 1 ? { account: active[0], needsChoice: false } : { needsChoice: true };
}

/**
 * Calculates financial figures for a given month
 */
export function calculateMonthFinancials(context: MoneContext, targetMonthStr: string) {
  const { currentBalance, bills, incomes, expenses, statusRecords } = context;
  const statusMap = new Map<string, MonthlyStatusRecord>();
  for (const rec of statusRecords) {
    statusMap.set(rec.id, rec);
  }

  interface OccItem {
    id: string;
    name: string;
    amount: number;
    currency: CurrencyCode;
    category: string;
    date: string;
    isCompleted: boolean;
    isRefund?: boolean;
    isRefunded?: boolean;
  }

  const monthIncomes: OccItem[] = [];
  for (const inc of incomes) {
    if (doesItemOccurInMonth(inc.startMonth, targetMonthStr, inc.recurrence, inc.recurrenceMonthsCount)) {
      const exc = inc.exceptions?.[targetMonthStr];
      if (exc?.isDeleted || inc.excludedMonths?.includes(targetMonthStr)) continue;

      const effAmount = exc?.amount ?? inc.amount;
      const effDay = exc?.expectedDay ?? inc.expectedDay;
      const effDate = exc?.expectedDate ?? getEffectiveDateForMonth(targetMonthStr, effDay);
      const isCompleted = statusMap.get(`income_${inc.id}_${targetMonthStr}`)?.isCompleted === true;

      const effectiveDistributions = exc?.accountDistributions ?? inc.accountDistributions;
      if (effectiveDistributions?.length) {
        for (const distribution of effectiveDistributions) {
          const distributionAccount = context.accounts?.find((account) => account.id === distribution.accountId);
          monthIncomes.push({
            id: inc.id,
            name: inc.name,
            amount: distribution.amount,
            currency: distributionAccount?.currency || context.currency,
            category: inc.category,
            date: effDate,
            isCompleted,
            isRefund: inc.isRefund,
            isRefunded: inc.isRefunded,
          });
        }
      } else {
        const linkedAccountId = exc?.accountId ?? inc.accountId;
        const linkedAccount = context.accounts?.find((account) => account.id === linkedAccountId);
        monthIncomes.push({
          id: inc.id,
          name: inc.name,
          amount: effAmount,
          currency: linkedAccount?.currency || context.currency,
          category: inc.category,
          date: effDate,
          isCompleted,
          isRefund: inc.isRefund,
          isRefunded: inc.isRefunded,
        });
      }
    }
  }

  const monthBills: OccItem[] = [];
  for (const bill of bills) {
    if (doesItemOccurInMonth(bill.startMonth, targetMonthStr, bill.recurrence, bill.recurrenceMonthsCount)) {
      const exc = bill.exceptions?.[targetMonthStr];
      if (exc?.isDeleted || bill.excludedMonths?.includes(targetMonthStr)) continue;

      const effAmount = exc?.amount ?? bill.amount;
      const effDay = exc?.dueDay ?? bill.dueDay;
      const effDate = exc?.dueDate ?? getEffectiveDateForMonth(targetMonthStr, effDay);
      const effectiveDistributions = exc?.accountDistributions ?? bill.accountDistributions;
      const isCompleted = statusMap.get(`bill_${bill.id}_${targetMonthStr}`)?.isCompleted === true;
      if (effectiveDistributions?.length) {
        for (const distribution of effectiveDistributions) {
          const distributionAccount = context.accounts?.find((account) => account.id === distribution.accountId);
          monthBills.push({
            id: bill.id,
            name: bill.name,
            amount: distribution.amount,
            currency: distributionAccount?.currency || context.currency,
            category: bill.category,
            date: effDate,
            isCompleted,
            isRefund: bill.isRefund,
            isRefunded: bill.isRefunded,
          });
        }
      } else {
        const linkedAccountId = exc?.accountId ?? bill.accountId;
        const linkedAccount = context.accounts?.find((account) => account.id === linkedAccountId);
        monthBills.push({
          id: bill.id,
          name: bill.name,
          amount: effAmount,
          currency: linkedAccount?.currency || context.currency,
          category: bill.category,
          date: effDate,
          isCompleted,
          isRefund: bill.isRefund,
          isRefunded: bill.isRefunded,
        });
      }
    }
  }

  // Include the user's own share of shared bills, just like the monthly report.
  if (context.myUserId) {
    for (const sharedBill of context.sharedBills || []) {
      const startMonth = sharedBill.startMonth || sharedBill.month || (sharedBill.dueDate || '').slice(0, 7);
      if (!doesItemOccurInMonth(startMonth, targetMonthStr, sharedBill.recurrence || 'none', sharedBill.recurrenceMonthsCount)) continue;
      const exception = sharedBill.exceptions?.[targetMonthStr];
      if (exception?.isDeleted || exception?.deletedForUsers?.includes(context.myUserId) ||
          sharedBill.excludedMonths?.includes(targetMonthStr) || sharedBill.hiddenForUsers?.includes(context.myUserId) ||
          sharedBill.shareRequest?.status === 'rejected') continue;
      if (!sharedBill.members?.includes(context.myUserId)) continue;
      const myShare = exception?.shares?.[context.myUserId] || sharedBill.shares?.[context.myUserId];
      if (!myShare) continue;
      const accountId = exception?.accountId || sharedBill.accountId;
      const linkedAccount = context.accounts?.find((account) => account.id === accountId);
      const completed = statusMap.get(`bill_sb_${sharedBill.id}_${targetMonthStr}`)?.isCompleted === true ||
        myShare.status === 'paid';
      monthBills.push({
        id: `sb_${sharedBill.id}`,
        name: `[Compartilhada] ${exception?.title || sharedBill.title}`,
        amount: Number(myShare.amount) || 0,
        currency: linkedAccount?.currency || context.currency,
        category: sharedBill.category || 'Contas Compartilhadas',
        date: getEffectiveDateForMonth(targetMonthStr, sharedBill.dueDay || 1),
        isCompleted: completed,
      });
    }
  }

  const monthExpenses = expenses.filter((expense) =>
    expense.date && expense.date.startsWith(targetMonthStr) && !expense.isRefund && !expense.isRefunded
  );

  const validIncomes = monthIncomes.filter((item) => !item.isRefund && !item.isRefunded);
  const validBills = monthBills.filter((item) => !item.isRefund && !item.isRefunded);
  const totalIncomes = validIncomes.reduce((acc, item) => acc + item.amount, 0);
  const totalBills = validBills.reduce((acc, item) => acc + item.amount, 0);
  const totalOneOffExpenses = monthExpenses.reduce((acc, item) => acc + item.amount, 0);

  const receivedIncomes = validIncomes.filter((item) => item.isCompleted).reduce((acc, item) => acc + item.amount, 0);
  const pendingIncomes = validIncomes.filter((item) => !item.isCompleted).reduce((acc, item) => acc + item.amount, 0);
  const paidBills = validBills.filter((item) => item.isCompleted).reduce((acc, item) => acc + item.amount, 0);
  const pendingBills = validBills.filter((item) => !item.isCompleted).reduce((acc, item) => acc + item.amount, 0);

  const pendingIncomesByCurrency = new Map<CurrencyCode, number>();
  const pendingBillsByCurrency = new Map<CurrencyCode, number>();
  const expensesByCurrency = new Map<CurrencyCode, number>();
  for (const item of validIncomes.filter((entry) => !entry.isCompleted)) {
    pendingIncomesByCurrency.set(item.currency, (pendingIncomesByCurrency.get(item.currency) || 0) + item.amount);
  }
  for (const item of validBills.filter((entry) => !entry.isCompleted)) {
    pendingBillsByCurrency.set(item.currency, (pendingBillsByCurrency.get(item.currency) || 0) + item.amount);
  }
  for (const expense of monthExpenses) {
    const distributions = (expense as any).accountDistributions as { accountId: string; amount: number }[] | undefined;
    if (distributions?.length) {
      for (const distribution of distributions) {
        const linkedAccount = context.accounts?.find((account) => account.id === distribution.accountId);
        const code = linkedAccount?.currency || context.currency;
        expensesByCurrency.set(code, (expensesByCurrency.get(code) || 0) + distribution.amount);
      }
    } else {
      const linkedAccount = context.accounts?.find((account) => account.id === (expense as any).accountId);
      const code = linkedAccount?.currency || context.currency;
      expensesByCurrency.set(code, (expensesByCurrency.get(code) || 0) + expense.amount);
    }
  }

  const monthlySurplus = totalIncomes - totalBills - totalOneOffExpenses;

  // SisFinz report rule: actual account balance + pending income - pending bills.
  // Keep currencies isolated; never add ARS, USD, BRL or EUR together.
  const projectedBalanceByCurrency = getCurrentBalancesByCurrency(context);
  for (const [code, amount] of pendingIncomesByCurrency) {
    projectedBalanceByCurrency.set(code, (projectedBalanceByCurrency.get(code) || 0) + amount);
  }
  for (const [code, amount] of pendingBillsByCurrency) {
    projectedBalanceByCurrency.set(code, (projectedBalanceByCurrency.get(code) || 0) - amount);
  }
  const projectedBalance = projectedBalanceByCurrency.get(context.currency)
    ?? [...projectedBalanceByCurrency.values()][0]
    ?? currentBalance;

  return {
    targetMonthStr,
    monthIncomes,
    monthBills,
    monthExpenses,
    totalIncomes,
    totalBills,
    totalOneOffExpenses,
    receivedIncomes,
    pendingIncomes,
    paidBills,
    pendingBills,
    pendingIncomesByCurrency,
    pendingBillsByCurrency,
    expensesByCurrency,
    monthlySurplus,
    projectedBalance,
    projectedBalanceByCurrency,
  };
}

/**
 * Intelligent categorization helper
 */
function inferCategory(name: string, type: 'expense' | 'bill' | 'income'): string {
  const norm = normalize(name);
  if (type === 'income') {
    if (norm.includes('salario') || norm.includes('salário')) return 'Salário';
    if (norm.includes('freelance') || norm.includes('freela') || norm.includes('bico')) return 'Freelance';
    if (norm.includes('venda')) return 'Vendas';
    if (norm.includes('investimento') || norm.includes('dividendo')) return 'Investimentos';
    return 'Outros';
  }

  // Expense or Bill
  if (norm.includes('uber') || norm.includes('transporte') || norm.includes('gasolina') || norm.includes('combustivel') || norm.includes('taxi') || norm.includes('onibus') || norm.includes('metro') || norm.includes('pedagio')) {
    return 'Transporte';
  }
  if (norm.includes('mercado') || norm.includes('supermercado') || norm.includes('almoco') || norm.includes('almoço') || norm.includes('jantar') || norm.includes('comida') || norm.includes('restaurante') || norm.includes('lanche') || norm.includes('padaria') || norm.includes('pizza') || norm.includes('ifood')) {
    return 'Alimentação';
  }
  if (norm.includes('farmacia') || norm.includes('farmácia') || norm.includes('remedio') || norm.includes('remédio') || norm.includes('medico') || norm.includes('médico') || norm.includes('saude') || norm.includes('saúde') || norm.includes('dentista')) {
    return 'Saúde';
  }
  if (norm.includes('aluguel') || norm.includes('condominio') || norm.includes('condomínio') || norm.includes('luz') || norm.includes('energia') || norm.includes('agua') || norm.includes('água') || norm.includes('gas') || norm.includes('gás') || norm.includes('iptu')) {
    return 'Moradia';
  }
  if (norm.includes('internet') || norm.includes('celular') || norm.includes('telefone') || norm.includes('netflix') || norm.includes('spotify') || norm.includes('streaming') || norm.includes('assinatura')) {
    return 'Assinaturas & Serviços';
  }
  if (norm.includes('academia') || norm.includes('ginásio') || norm.includes('esporte') || norm.includes('cinema') || norm.includes('show') || norm.includes('viagem') || norm.includes('hotel')) {
    return 'Lazer & Estilo de Vida';
  }
  if (norm.includes('tenis') || norm.includes('tênis') || norm.includes('roupa') || norm.includes('sapato') || norm.includes('shopping') || norm.includes('celular') || norm.includes('notebook') || norm.includes('eletronico')) {
    return 'Compras';
  }
  return 'Outros';
}

/**
 * Robust item matchers with fuzzy matching and ambiguity detection
 */
export function findMatchingBill(
  bills: BillItem[],
  queryName?: string,
  matchedId?: string,
  question?: string
): { match?: BillItem; ambiguous?: BillItem[] } {
  if (matchedId) {
    const byId = bills.find((b) => b.id === matchedId);
    if (byId) return { match: byId };
  }

  const nameToSearch = queryName || '';
  const normTarget = normalize(nameToSearch);

  if (normTarget) {
    // 1. Exact match
    const exact = bills.filter((b) => normalize(b.name) === normTarget);
    if (exact.length === 1) return { match: exact[0] };

    // 2. Contains match
    const contains = bills.filter(
      (b) => normalize(b.name).includes(normTarget) || normTarget.includes(normalize(b.name))
    );
    if (contains.length === 1) return { match: contains[0] };
    if (contains.length > 1) return { ambiguous: contains };
  }

  // 3. Search user question keywords against bill names
  if (question) {
    const normQ = normalize(question);
    const matches = bills.filter((b) => {
      const normB = normalize(b.name);
      if (normQ.includes(normB)) return true;
      const words = normB
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !['compra', 'conta', 'fatura', 'pagamento', 'para', 'com'].includes(w));
      return words.length > 0 && words.some((w) => normQ.includes(w));
    });
    if (matches.length === 1) return { match: matches[0] };
    if (matches.length > 1) return { ambiguous: matches };
  }

  if (bills.length === 1 && !normTarget) {
    return { match: bills[0] };
  }

  return {};
}

export function findMatchingExpense(
  expenses: ExpenseItem[],
  queryName?: string,
  matchedId?: string,
  lastActionItem?: MoneActionItem | null,
  question?: string
): { match?: ExpenseItem; ambiguous?: ExpenseItem[] } {
  if (matchedId) {
    const byId = expenses.find((e) => e.id === matchedId);
    if (byId) return { match: byId };
  }

  if (lastActionItem && lastActionItem.type === 'expense') {
    const byLast = expenses.find((e) => e.id === lastActionItem.id);
    if (byLast) return { match: byLast };
  }

  const nameToSearch = queryName || '';
  const normTarget = normalize(nameToSearch);

  if (normTarget) {
    const exact = expenses.filter((e) => normalize(e.name) === normTarget);
    if (exact.length === 1) return { match: exact[0] };

    const contains = expenses.filter(
      (e) => normalize(e.name).includes(normTarget) || normTarget.includes(normalize(e.name))
    );
    if (contains.length === 1) return { match: contains[0] };
    if (contains.length > 1) return { ambiguous: contains };
  }

  if (question) {
    const normQ = normalize(question);
    const matches = expenses.filter((e) => {
      const normE = normalize(e.name);
      return normQ.includes(normE) || normE.split(/\s+/).some((w) => w.length >= 3 && normQ.includes(w));
    });
    if (matches.length === 1) return { match: matches[0] };
    if (matches.length > 1) return { ambiguous: matches };
  }

  return {};
}

export function findMatchingIncome(
  incomes: IncomeItem[],
  queryName?: string,
  matchedId?: string,
  lastActionItem?: MoneActionItem | null,
  question?: string
): { match?: IncomeItem; ambiguous?: IncomeItem[] } {
  if (matchedId) {
    const byId = incomes.find((i) => i.id === matchedId);
    if (byId) return { match: byId };
  }

  if (lastActionItem && lastActionItem.type === 'income') {
    const byLast = incomes.find((i) => i.id === lastActionItem.id);
    if (byLast) return { match: byLast };
  }

  const nameToSearch = queryName || '';
  const normTarget = normalize(nameToSearch);

  if (normTarget) {
    const matches = incomes.filter(
      (i) => normalize(i.name).includes(normTarget) || normTarget.includes(normalize(i.name))
    );
    if (matches.length === 1) return { match: matches[0] };
    if (matches.length > 1) return { ambiguous: matches };
  }

  if (question) {
    const normQ = normalize(question);
    const matches = incomes.filter((i) => {
      const normI = normalize(i.name);
      return normQ.includes(normI) || normI.split(/\s+/).some((w) => w.length >= 3 && normQ.includes(w));
    });
    if (matches.length === 1) return { match: matches[0] };
    if (matches.length > 1) return { ambiguous: matches };
  }

  if (incomes.length === 1 && !normTarget) {
    return { match: incomes[0] };
  }

  return {};
}

/**
 * Main Mone Engine:
 * Truly intelligent natural language processing with conversational memory,
 * direct database execution, and concise responses.
 */
export async function askMone(question: string, context: MoneContext, audio?: { data: string; mimeType: string }): Promise<MoneResponse> {
  const norm = normalize(question);
  const { currentBalance, currency, language, goals, bills, incomes, expenses, handlers, lastActionItem } = context;
  const currentMonthStr = getCurrentMonthStr();
  const todayStr = getTodayStr();
  const locale = getLocaleForLanguage(language);

  // Mone identity is deterministic: never expose the underlying AI model name.
  if (/\b(?:qual\s+(?:era\s+)?(?:o\s+)?nome\s+(?:dela|seu)|qual\s+(?:e|era)\s+(?:o\s+)?seu\s+nome|como\s+voce\s+se\s+chama|quem\s+e\s+voce|seu\s+nome)\b/i.test(norm)) {
    return { text: 'Meu nome é Mone. Sou a inteligência integrada ao SisFinz e estou aqui para conversar e cuidar das suas finanças com você.', isInternalCalculation: true };
  }

  // Route core financial questions directly to real SisFinz data before asking an LLM.
  const targetMonth = extractTargetMonth(question, currentMonthStr);
  const asksForecast =
    /\b(?:quanto\s+(?:que\s+)?(?:vai\s+)?(?:me\s+)?sobr\w*|quanto\s+(?:que\s+)?(?:me\s+)?rest\w*|previs[aã]o|proje[cç][aã]o|saldo\s+(?:final|no\s+fim)|fim\s+do\s+m[eê]s|fechamento\s+do\s+m[eê]s)\b/i.test(norm) ||
    (/\bsaldo\b/i.test(norm) && /\b(?:em|de|no|na|para|do|da)\s+(?:pr[oó]xim[oa]\s+m[eê]s|m[eê]s\s+que\s+vem|janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|20\d{2})\b/i.test(norm));
  const asksBills = /\b(?:contas?|faturas?|boletos?)\b/i.test(norm) && /\b(?:pagar|pagamento|total|quanto|tenho|devo|pr[oó]xim[oa]|m[eê]s|venc\w*)\b/i.test(norm);
  const asksIncomes = /\b(?:ingressos?|receitas?|entradas?|receber|vou\s+receber)\b/i.test(norm) && /\b(?:total|quanto|tenho|pr[oó]xim[oa]|m[eê]s|previst\w*|vou\s+receber)\b/i.test(norm);

  if (asksForecast) {
    if (targetMonth !== currentMonthStr && handlers?.onViewForecastMonth) {
      await handlers.onViewForecastMonth(targetMonth);
    }
    const monthData = calculateMonthFinancials(context, targetMonth);
    const monthName = formatMonthName(targetMonth, locale).split(' ')[0];
    const projectedSummary = formatCurrencyBreakdown(monthData.projectedBalanceByCurrency);
    return {
      text: `A previsão de saldo no fim de ${monthName} é ${projectedSummary}.`,
      isInternalCalculation: true,
    };
  }

  if (asksBills) {
    if (targetMonth !== currentMonthStr && handlers?.onViewForecastMonth) await handlers.onViewForecastMonth(targetMonth);
    const billsResult = await executeMoneIntent({ intent: 'query_bills', data: { targetMonth } }, context);
    return billsResult || { text: 'Não consegui consultar as contas desse período agora.', isInternalCalculation: true };
  }

  if (asksIncomes) {
    if (targetMonth !== currentMonthStr && handlers?.onViewForecastMonth) await handlers.onViewForecastMonth(targetMonth);
    const incomesResult = await executeMoneIntent({ intent: 'query_incomes', data: { targetMonth } }, context);
    return incomesResult || { text: 'Não consegui consultar os ingressos desse período agora.', isInternalCalculation: true };
  }

  const asksSavings =
    /\b(?:cofrinho|cofrinhos|reserva|reservas|poupanca|poupancas|guardad\w*|poupad\w*|dinheiro\s+guardado|valor\s+guardado)\b/i.test(norm) &&
    /\b(?:quanto|total|tenho|guardado|poupado|saldo|progresso|historico|hist[oó]rico|falta)\b/i.test(norm);
  if (asksSavings) {
    const savingsResult = await executeMoneIntent({
      intent: /\b(?:historico|hist[oó]rico|movimentacoes|transacoes)\b/i.test(norm) ? 'query_saving_transactions' : 'query_savings',
    }, context);
    return savingsResult || { text: 'Não consegui consultar seus cofrinhos agora.', isInternalCalculation: true };
  }

  // 1. Math queries (e.g. "Quanto é 50.000 + 50.000?" -> "100.000.")
  const mathResult = audio ? null : trySolveMath(question);
  if (mathResult !== null) {
    return {
      text: mathResult,
      isInternalCalculation: true,
    };
  }

  // 2. CONVERSATIONAL CORRECTION (e.g. "Na verdade, foi 3000, não 2500" or "corrige para 3000")
  const isCorrection =
    /\bna verdade\b.*\b(?:foi|era|para)\s+\d/i.test(norm) ||
    /\b(?:corrige|corrigir|corrija|mude o valor|muda para|mudar para|troque|trocar|altere|alterar)\b.*\b(?:para|em)\s+\d/i.test(norm) ||
    (/^nao\b/.test(norm) && /\b(?:foi|era)\s+\d/i.test(norm));

  if (isCorrection && lastActionItem) {
    // Extract new amount
    // e.g. "Na verdade, foi 3000, não 2500" -> 3000
    const matches = question.match(/(?:[$R€]\s*)?([\d\.,]+)/g);
    let newAmount: number | null = null;

    if (matches && matches.length > 0) {
      for (const mStr of matches) {
        const val = parseAmountFromText(mStr);
        if (val && val > 0 && val !== lastActionItem.amount) {
          newAmount = val;
          break;
        }
      }
      if (newAmount === null && matches[0]) {
        newAmount = parseAmountFromText(matches[0]);
      }
    }

    if (newAmount !== null && newAmount > 0) {
      const recordExists =
        (lastActionItem.type === 'expense' && expenses.some((item) => item.id === lastActionItem.id)) ||
        (lastActionItem.type === 'bill' && bills.some((item) => item.id === lastActionItem.id)) ||
        (lastActionItem.type === 'income' && incomes.some((item) => item.id === lastActionItem.id));
      if (!recordExists) {
        return {
          text: 'Não encontrei mais o último lançamento que você quer corrigir. Diga o nome do registro para eu localizar o item certo.',
          isInternalCalculation: true,
        };
      }
      try {
        if (lastActionItem.type === 'expense' && handlers?.onUpdateExpense) {
          await handlers.onUpdateExpense(lastActionItem.id, { amount: newAmount });
        } else if (lastActionItem.type === 'bill' && handlers?.onUpdateBill) {
          await handlers.onUpdateBill(lastActionItem.id, { amount: newAmount });
        } else if (lastActionItem.type === 'income' && handlers?.onUpdateIncome) {
          await handlers.onUpdateIncome(lastActionItem.id, { amount: newAmount });
        } else {
          return { text: 'A edição desse tipo de lançamento não está disponível.', isInternalCalculation: true };
        }
      } catch (err: any) {
        return { text: `Não consegui corrigir o lançamento: ${err?.message || 'falha ao salvar'}.`, isInternalCalculation: true };
      }

      const formatted = formatCurrencySpoken(newAmount, currency);
      return {
        text: `Corrigido. Valor de ${lastActionItem.name} alterado para ${formatted}.`,
        isInternalCalculation: true,
        actionExecuted: 'correction',
        createdItem: { ...lastActionItem, amount: newAmount },
      };
    }
  }

  // 3. CATEGORY SPENDING QUERY (e.g. "Quanto gastei com transporte este mês?")
  const isCategorySpendingQuery =
    (norm.includes('quanto gastei') || norm.includes('quanto foi gasto') || norm.includes('gastos com') || norm.includes('despesas com')) &&
    !norm.includes('comprei') &&
    !norm.includes('adicione');

  if (isCategorySpendingQuery) {
    const targetMonth = extractTargetMonth(question, currentMonthStr);
    const monthData = calculateMonthFinancials(context, targetMonth);
    const monthName = formatMonthName(targetMonth, locale).split(' ')[0];

    // Identify category
    let targetCat = 'Transporte';
    if (norm.includes('transporte') || norm.includes('uber') || norm.includes('gasolina')) targetCat = 'Transporte';
    else if (norm.includes('alimentacao') || norm.includes('comida') || norm.includes('mercado') || norm.includes('restaurante')) targetCat = 'Alimentação';
    else if (norm.includes('saude') || norm.includes('farmacia') || norm.includes('medico')) targetCat = 'Saúde';
    else if (norm.includes('moradia') || norm.includes('aluguel') || norm.includes('casa')) targetCat = 'Moradia';
    else if (norm.includes('lazer')) targetCat = 'Lazer & Estilo de Vida';
    else if (norm.includes('compras') || norm.includes('roupa')) targetCat = 'Compras';

    const catExpenses = monthData.monthExpenses.filter((e) => e.category === targetCat || inferCategory(e.name, 'expense') === targetCat);
    const catBills = monthData.monthBills.filter((b) => b.category === targetCat || inferCategory(b.name, 'bill') === targetCat);

    const sumExpenses = catExpenses.reduce((s, e) => s + e.amount, 0);
    const sumBills = catBills.reduce((s, b) => s + b.amount, 0);
    const totalCat = sumExpenses + sumBills;

    if (totalCat === 0) {
      return {
        text: `Você não possui gastos registrados com ${targetCat} em ${monthName}.`,
        isInternalCalculation: true,
      };
    }

    return {
      text: `Você gastou ${formatCurrencySpoken(totalCat, currency)} com ${targetCat} em ${monthName}.`,
      isInternalCalculation: true,
    };
  }

  // Deterministic debt/bill queries: financial facts must come only from SisFinz records.
  const isPendingBillsQuestion =
    /\b(tenho|tem|existe|existem|quais|quanto|alguma|algum|falta|faltam|devo|divid\w*|contas?\s+(?:a|para)\s+pagar|a\s+pagar|pendentes?|pendencia|pendencias|bills?|debts?)\b/.test(norm) &&
    /\b(divid\w*|devo|pagar|pagamento|contas?|faturas?|pendentes?|pendencia|pendencias|bills?|debts?)\b/.test(norm);

  if (isPendingBillsQuestion) {
    const targetMonth = extractTargetMonth(question, currentMonthStr);
    const data = calculateMonthFinancials(context, targetMonth);
    const pending = data.monthBills.filter((bill) => !bill.isCompleted);
    const monthName = formatMonthName(targetMonth, locale).split(' ')[0];

    if (pending.length === 0) {
      return {
        text: `Não encontrei contas pendentes cadastradas no SisFinz para ${monthName}. Não há nenhuma dívida registrada para esse mês.`,
        isInternalCalculation: true,
      };
    }

    const totalPending = pending.reduce((sum, bill) => sum + bill.amount, 0);
    const lines = pending.map((bill) =>
      `• ${bill.name}: ${formatCurrencySpoken(bill.amount, currency)} (vencimento: ${bill.date})`
    );
    return {
      text: `Encontrei ${pending.length} conta(s) pendente(s) em ${monthName}, totalizando ${formatCurrencySpoken(totalPending, currency)}:\n${lines.join('\n')}`,
      isInternalCalculation: true,
    };
  }

  // 4. EXECUTE STRUCTURED MONE INTENT
  async function executeMoneIntent(parsed: any, ctx: MoneContext): Promise<MoneResponse | null> {
    if (!parsed || !parsed.intent) return null;
    const intent = parsed.intent;
    const d = { ...parsed, ...(parsed.data || {}) };
    if (intent === 'conversation' || intent === 'general_query' || intent === 'math') {
      const conversationalText = typeof parsed.directResponse === 'string' ? parsed.directResponse.trim() : '';
      if (conversationalText) {
        return { text: conversationalText, isInternalCalculation: false };
      }
    }
    const { currency, handlers, lastActionItem, bills, incomes, expenses, currentBalance } = ctx;
    const currentMonthStr = getCurrentMonthStr();
    const todayStr = getTodayStr();
    const locale = getLocaleForLanguage(ctx.language);

    if (intent === 'navigate_to_section') {
      const allowedSections: MoneNavigationSection[] = [
        'finance', 'planejar', 'goals', 'savings', 'categories', 'report',
        'shared_accounts', 'challenge_52', 'full_report', 'accounts',
        'financial_calendar', 'freedom', 'daily_pace',
      ];
      const section = d.section as MoneNavigationSection;
      if (!allowedSections.includes(section) || !handlers?.onNavigateToSection) {
        return { text: 'Não consegui identificar qual tela do SisFinz você quer abrir. Pode dizer o nome da seção?', isInternalCalculation: true };
      }
      await handlers.onNavigateToSection(section);
      const labels: Record<MoneNavigationSection, string> = {
        finance: 'início', planejar: 'planejamento', goals: 'metas', savings: 'cofrinhos',
        categories: 'categorias', report: 'relatórios', shared_accounts: 'contas compartilhadas',
        challenge_52: 'desafio de 52 semanas', full_report: 'relatório completo',
        accounts: 'contas', financial_calendar: 'calendário financeiro',
        freedom: 'liberdade financeira', daily_pace: 'ritmo diário',
      };
      return { text: `Abri a seção ${labels[section]} do SisFinz.`, isInternalCalculation: true, actionExecuted: 'navigate_to_section' };
    }

    // Complete a 52-week challenge deposit through the existing account-balance workflow.
    if (intent === 'complete_challenge_week') {
      if (!handlers?.onCompleteChallengeWeek) {
        return { text: 'A integração com o desafio semanal ainda não está disponível.', isInternalCalculation: true };
      }
      const challenges = ctx.weeklyChallenges || [];
      const challengeName = normalize(d.challengeName || d.name || '');
      const challengeMatches = d.challengeId
        ? challenges.filter((challenge) => challenge.id === d.challengeId)
        : challenges.filter((challenge) => challengeName && normalize(challenge.title).includes(challengeName));
      if (challengeMatches.length !== 1) {
        return {
          text: challengeMatches.length > 1
            ? 'Encontrei mais de um desafio semanal. Qual deles você quer atualizar?'
            : 'Qual desafio semanal você quer atualizar? Diga o nome do plano.',
          isInternalCalculation: true,
        };
      }
      const challenge = challengeMatches[0];
      const weekNumber = Number(d.weekNumber);
      const totalWeeks = Math.max(1, Math.floor(challenge.totalWeeks || 52));
      if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > totalWeeks) {
        return { text: `Qual semana do desafio "${challenge.title}" você deseja concluir? O plano vai até a semana ${totalWeeks}.`, isInternalCalculation: true };
      }
      const completedWeeks = challenge.completedWeeks || [];
      if (completedWeeks.includes(weekNumber)) {
        return { text: `A semana ${weekNumber} do desafio "${challenge.title}" já está concluída.`, isInternalCalculation: true };
      }
      const accountName = normalize(d.accountName || '');
      const accountMatches = (ctx.accounts || []).filter((account) =>
        account.isActive !== false &&
        (d.accountId ? account.id === d.accountId : Boolean(accountName && normalize(account.name).includes(accountName))) &&
        (!challenge.currency || account.currency === challenge.currency)
      );
      if (accountMatches.length !== 1) {
        return {
          text: accountMatches.length > 1
            ? 'Encontrei mais de uma conta compatível. De qual conta devo retirar o valor dessa semana?'
            : 'De qual conta devo retirar o valor para concluir essa semana? Diga o nome da conta.',
          isInternalCalculation: true,
        };
      }
      const fixedWeeklyAmount = Math.round((challenge.totalTarget / totalWeeks) * 100) / 100;
      const amount = (challenge.savingMode || 'progressive') === 'fixed'
        ? (weekNumber === totalWeeks
            ? Math.round((challenge.totalTarget - fixedWeeklyAmount * (totalWeeks - 1)) * 100) / 100
            : fixedWeeklyAmount)
        : Math.round(challenge.initialAmount * weekNumber * 100) / 100;
      try {
        await handlers.onCompleteChallengeWeek(challenge.id, weekNumber, accountMatches[0].id);
        return {
          text: parsed.directResponse || `Semana ${weekNumber} do desafio "${challenge.title}" concluída. ${formatCurrencySpoken(amount, challenge.currency || currency)} foi separado de ${accountMatches[0].name}.`,
          isInternalCalculation: true,
          actionExecuted: 'complete_challenge_week',
        };
      } catch (err: any) {
        return {
          text: `Não consegui concluir a semana do desafio: ${err?.message || 'falha ao salvar'}.`,
          isInternalCalculation: true,
        };
      }
    }

    // Undo a weekly challenge deposit by returning the money to a selected account.
    if (intent === 'undo_challenge_week') {
      if (!handlers?.onUndoChallengeWeek) {
        return { text: 'A reversão do depósito semanal não está disponível neste momento.', isInternalCalculation: true };
      }
      const challenges = ctx.weeklyChallenges || [];
      const challengeName = normalize(d.challengeName || d.name || '');
      const challengeMatches = d.challengeId
        ? challenges.filter((challenge) => challenge.id === d.challengeId)
        : challenges.filter((challenge) => challengeName && normalize(challenge.title).includes(challengeName));
      if (challengeMatches.length !== 1) {
        return {
          text: challengeMatches.length > 1
            ? 'Encontrei mais de um desafio semanal. Qual deles você quer corrigir?'
            : 'Qual desafio semanal você quer corrigir? Diga o nome do plano.',
          isInternalCalculation: true,
        };
      }
      const challenge = challengeMatches[0];
      const weekNumber = Number(d.weekNumber);
      const completedWeeks = challenge.completedWeeks || [];
      if (!Number.isInteger(weekNumber) || !completedWeeks.includes(weekNumber)) {
        return { text: `A semana ${d.weekNumber || ''} não aparece como concluída no desafio "${challenge.title}". Qual semana você deseja desfazer?`, isInternalCalculation: true };
      }
      const accountName = normalize(d.accountName || '');
      const accountMatches = (ctx.accounts || []).filter((account) =>
        account.isActive !== false &&
        (d.accountId ? account.id === d.accountId : Boolean(accountName && normalize(account.name).includes(accountName))) &&
        (!challenge.currency || account.currency === challenge.currency)
      );
      if (accountMatches.length !== 1) {
        return {
          text: accountMatches.length > 1
            ? 'Encontrei mais de uma conta compatível. Em qual conta devo devolver o dinheiro?'
            : 'Em qual conta devo devolver o dinheiro dessa semana? Diga o nome da conta.',
          isInternalCalculation: true,
        };
      }
      try {
        await handlers.onUndoChallengeWeek(challenge.id, weekNumber, accountMatches[0].id);
        return {
          text: parsed.directResponse || `Desfiz a semana ${weekNumber} do desafio "${challenge.title}" e devolvi o valor para ${accountMatches[0].name}.`,
          isInternalCalculation: true,
          actionExecuted: 'undo_challenge_week',
        };
      } catch (err: any) {
        return {
          text: `Não consegui desfazer o depósito semanal: ${err?.message || 'falha ao salvar'}.`,
          isInternalCalculation: true,
        };
      }
    }

    // Mark only the authenticated user's share of a shared bill as paid.
    if (intent === 'mark_shared_share_paid') {
      if (!handlers?.onToggleMySharePaid) {
        return { text: 'A função de contas compartilhadas não está disponível agora.', isInternalCalculation: true };
      }
      const available = (ctx.sharedBills || []).filter((bill) =>
        !ctx.myUserId || bill.members.includes(ctx.myUserId)
      );
      const requestedName = normalize(d.name || '');
      const matches = d.matchedId
        ? available.filter((bill) => bill.id === d.matchedId)
        : available.filter((bill) => {
            const title = normalize(bill.title);
            return requestedName ? title === requestedName || title.includes(requestedName) || requestedName.includes(title) : false;
          });
      if (matches.length !== 1) {
        return {
          text: matches.length > 1
            ? `Encontrei mais de uma conta compartilhada correspondente. Qual delas você já pagou?`
            : 'Qual conta compartilhada você pagou? Diga o nome dela para eu marcar somente a sua parte.',
          isInternalCalculation: true,
        };
      }
      const target = matches[0];
      const targetMonth = d.targetMonth || target.month;
      try {
        await handlers.onToggleMySharePaid(target.id, true, targetMonth);
        const share = ctx.myUserId ? target.shares?.[ctx.myUserId]?.amount : undefined;
        return {
          text: `Pronto. Marquei sua parte de "${target.title}" como paga${typeof share === 'number' ? ` (${formatCurrencySpoken(share, currency)})` : ''}.`,
          isInternalCalculation: true,
          actionExecuted: 'mark_shared_share_paid',
        };
      } catch (err: any) {
        return {
          text: `Não consegui marcar sua parte como paga: ${err?.message || 'falha ao salvar'}.`,
          isInternalCalculation: true,
        };
      }
    }

    // TRANSFER BETWEEN OWN ACCOUNTS. Resolve both accounts uniquely and keep currencies identical.
    if (intent === 'transfer_between_accounts') {
      if (!handlers?.onTransferBetweenAccounts) {
        return { text: 'A transferência entre contas não está disponível neste momento.', isInternalCalculation: true };
      }
      const activeAccounts = (ctx.accounts || []).filter((account) => account.isActive !== false);
      const resolveAccount = (id?: string, name?: string) => {
        if (id) return activeAccounts.find((account) => account.id === id);
        const target = normalize(name || '');
        if (!target) return undefined;
        const matches = activeAccounts.filter((account) => {
          const candidate = normalize(account.name);
          return candidate === target || candidate.includes(target) || target.includes(candidate);
        });
        return matches.length === 1 ? matches[0] : undefined;
      };
      const fromAccount = resolveAccount(d.fromAccountId, d.fromAccountName);
      const toAccount = resolveAccount(d.toAccountId, d.toAccountName);
      if (!fromAccount || !toAccount) {
        return {
          text: 'Preciso identificar sem dúvida a conta de origem e a conta de destino. Diga os nomes das duas contas como aparecem no SisFinz.',
          isInternalCalculation: true,
        };
      }
      if (fromAccount.id === toAccount.id) {
        return { text: 'A conta de origem e a de destino precisam ser diferentes.', isInternalCalculation: true };
      }
      if (fromAccount.currency !== toAccount.currency) {
        return { text: 'As duas contas estão em moedas diferentes. Para evitar um câmbio incorreto, faça essa operação pela tela de transferência do SisFinz.', isInternalCalculation: true };
      }
      const amount = Number(d.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return { text: 'Qual valor você deseja transferir?', isInternalCalculation: true };
      }
      try {
        await handlers.onTransferBetweenAccounts({
          fromAccountId: fromAccount.id,
          toAccountId: toAccount.id,
          amount,
          date: d.date || todayStr,
          notes: d.notes || 'Transferência solicitada à Mone',
        });
        return {
          text: `Transferi ${formatCurrencySpoken(amount, fromAccount.currency)} de ${fromAccount.name} para ${toAccount.name}.`,
          isInternalCalculation: true,
          actionExecuted: 'transfer_between_accounts',
        };
      } catch (err: any) {
        return {
          text: `Não consegui concluir a transferência: ${err?.message || 'falha ao salvar'}.`,
          isInternalCalculation: true,
        };
      }
    }

    // 1. ADD EXPENSE
    if (intent === 'add_expense' && handlers?.onAddExpense) {
      if (!Number(d.amount) || Number(d.amount) <= 0) {
        return { text: 'Qual é o valor do gasto que você quer registrar?', isInternalCalculation: true };
      }
      try {
        const expName = d.name || 'Despesa';
        const selectedAccount = resolveMoneAccount(ctx, d.accountId, d.accountName);
        if (selectedAccount.needsChoice) {
          return { text: 'Em qual conta você fez esse gasto? Diga, por exemplo, Galicia ou Naranja.', isInternalCalculation: true };
        }
        const cat = d.category || inferCategory(expName, 'expense');
        const res = await handlers.onAddExpense({
          name: expName,
          amount: d.amount,
          date: d.date || todayStr,
          category: cat,
          ...(selectedAccount.account ? { accountId: selectedAccount.account.id } : {}),
        });
        const createdId = res && typeof res === 'object' && res.id ? res.id : 'exp_' + Date.now();
        return {
          text: `Despesa de ${expName} de ${formatCurrencySpoken(d.amount, selectedAccount.account?.currency || currency)} adicionada.`,
          isInternalCalculation: true,
          actionExecuted: 'add_expense',
          createdItem: { type: 'expense', id: createdId, name: expName, amount: d.amount },
        };
      } catch (err: any) {
        console.error('Error in onAddExpense:', err);
        return {
          text: `Erro ao salvar a despesa no banco de dados: ${err?.message || 'Falha na gravação'}. O registro não foi adicionado.`,
          isInternalCalculation: true,
        };
      }
    }

    // 2. ADD INSTALLMENT BILL
    if (intent === 'add_installment_bill' && handlers?.onAddBill) {
      if (!Number(d.amount || d.totalAmount) || Number(d.amount || d.totalAmount) <= 0) {
        return { text: 'Qual é o valor total dessa compra parcelada?', isInternalCalculation: true };
      }
      if (!Number(d.installmentsCount) || Number(d.installmentsCount) < 2) {
        return { text: 'Em quantas parcelas você quer dividir essa compra?', isInternalCalculation: true };
      }
      try {
        const installments = d.installmentsCount || 1;
        const instAmount = d.amount || (d.totalAmount ? Math.round((d.totalAmount / installments) * 100) / 100 : 0);
        const dueDay = d.dueDay || new Date().getDate();
        const startMonth = d.targetMonth || currentMonthStr;
        const dueDate = getEffectiveDateForMonth(startMonth, dueDay);
        const billName = d.name || 'Compra parcelada';

        const selectedAccount = resolveMoneAccount(ctx, d.accountId, d.accountName);
        if (selectedAccount.needsChoice) {
          return { text: 'Em qual conta do SisFinz essa compra parcelada deve ficar vinculada?', isInternalCalculation: true };
        }
        const res = await handlers.onAddBill({
          name: billName,
          amount: instAmount,
          dueDay,
          dueDate,
          category: d.category || inferCategory(billName, 'bill'),
          recurrence: 'monthly',
          recurrenceMonthsCount: installments,
          startMonth,
          ...(selectedAccount.account ? { accountId: selectedAccount.account.id } : {}),
        });

        const createdId = res && typeof res === 'object' && res.id ? res.id : 'bill_' + Date.now();
        return {
          text: `Pronto. ${billName} criada em ${installments} parcelas de ${formatCurrencySpoken(instAmount, selectedAccount.account?.currency || currency)}, todo dia ${dueDay}.`,
          isInternalCalculation: true,
          actionExecuted: 'add_installment',
          createdItem: { type: 'bill', id: createdId, name: billName, amount: instAmount },
        };
      } catch (err: any) {
        console.error('Error in onAddBill (installment):', err);
        return {
          text: `Erro ao salvar a compra parcelada no banco de dados: ${err?.message || 'Falha na gravação'}. O registro não foi criado.`,
          isInternalCalculation: true,
        };
      }
    }

    // 3. ADD REGULAR / RECURRING BILL
    if (intent === 'add_bill' && handlers?.onAddBill) {
      if (!d.amount) {
        return {
          text: parsed.directResponse || `Qual é o valor da conta de ${d.name || 'despesa'}?`,
          isInternalCalculation: true,
        };
      }
      try {
        const dueDay = d.dueDay || 10;
        const billName = d.name || 'Conta';
        const selectedAccount = resolveMoneAccount(ctx, d.accountId, d.accountName);
        if (selectedAccount.needsChoice) {
          return { text: 'Em qual conta do SisFinz essa fatura deve ficar vinculada?', isInternalCalculation: true };
        }
        const isRecur = d.isRecurring !== false;
        const startMonth = d.targetMonth || currentMonthStr;
        const res = await handlers.onAddBill({
          name: billName,
          amount: d.amount,
          dueDay,
          dueDate: getEffectiveDateForMonth(startMonth, dueDay),
          category: d.category || inferCategory(billName, 'bill'),
          recurrence: isRecur ? 'monthly' : 'none',
          ...(d.recurrenceMonthsCount ? { recurrenceMonthsCount: Number(d.recurrenceMonthsCount) } : {}),
          startMonth,
          ...(selectedAccount.account ? { accountId: selectedAccount.account.id } : {}),
        });
        const createdId = res && typeof res === 'object' && res.id ? res.id : 'bill_' + Date.now();
        return {
          text: `Pronto. Conta ${billName} de ${formatCurrencySpoken(d.amount, selectedAccount.account?.currency || currency)} criada para todo dia ${dueDay}.`,
          isInternalCalculation: true,
          actionExecuted: 'add_bill',
          createdItem: { type: 'bill', id: createdId, name: billName, amount: d.amount },
        };
      } catch (err: any) {
        console.error('Error in onAddBill:', err);
        return {
          text: `Erro ao salvar a conta no banco de dados: ${err?.message || 'Falha na gravação'}. O registro não foi criado.`,
          isInternalCalculation: true,
        };
      }
    }

    // 4. ADD INCOME
    if (intent === 'add_income' && handlers?.onAddIncome) {
      if (!Number(d.amount) || Number(d.amount) <= 0) {
        return { text: 'Qual é o valor da receita que você quer registrar?', isInternalCalculation: true };
      }
      try {
        const incName = d.name || 'Receita';
        const selectedAccount = resolveMoneAccount(ctx, d.accountId, d.accountName);
        if (selectedAccount.needsChoice) {
          return { text: 'Em qual conta você recebe essa receita?', isInternalCalculation: true };
        }
        const expDay = d.expectedDay || 5;
        const startMonth = d.targetMonth || currentMonthStr;
        const isRecur = typeof d.isRecurring === 'boolean'
          ? d.isRecurring
          : incName.toLowerCase().includes('salario') || incName.toLowerCase().includes('salário');
        const incomePayload = {
          name: incName,
          amount: d.amount,
          expectedDay: expDay,
          expectedDate: getEffectiveDateForMonth(startMonth, expDay),
          category: d.category || inferCategory(incName, 'income'),
          recurrence: isRecur ? 'monthly' as const : 'none' as const,
          ...(d.recurrenceMonthsCount ? { recurrenceMonthsCount: Number(d.recurrenceMonthsCount) } : {}),
          startMonth,
          ...(selectedAccount.account ? { accountId: selectedAccount.account.id } : {}),
        };
        const res = d.isReceived === true && handlers.onAddIncomeAsReceived
          ? await handlers.onAddIncomeAsReceived(incomePayload, startMonth)
          : await handlers.onAddIncome(incomePayload);
        const createdId = res && typeof res === 'object' && res.id ? res.id : 'inc_' + Date.now();
        if (d.isReceived === true && !handlers.onAddIncomeAsReceived && handlers?.onToggleIncomeReceived) {
          await handlers.onToggleIncomeReceived(createdId, startMonth, true);
        }
        return {
          text: `Receita de ${incName} de ${formatCurrencySpoken(d.amount, selectedAccount.account?.currency || currency)} adicionada.`,
          isInternalCalculation: true,
          actionExecuted: 'add_income',
          createdItem: { type: 'income', id: createdId, name: incName, amount: d.amount },
        };
      } catch (err: any) {
        console.error('Error in onAddIncome:', err);
        return {
          text: `Erro ao salvar a receita no banco de dados: ${err?.message || 'Falha na gravação'}. O registro não foi adicionado.`,
          isInternalCalculation: true,
        };
      }
    }

    // 5. UPDATE BILL (e.g. "mudar o vencimento da compra da sapatilha para o dia 20", "alterar valor da sapatilha para 150")
    if (intent === 'update_bill') {
      if (!handlers?.onUpdateBill) {
        return {
          text: 'Não foi possível atualizar a conta: manipulador do banco de dados indisponível.',
          isInternalCalculation: true,
        };
      }

      const billSearch = findMatchingBill(bills, d.name, d.matchedId || d.matchedBillId, question);
      if (billSearch.ambiguous && billSearch.ambiguous.length > 1) {
        const names = billSearch.ambiguous.map((b) => `"${b.name}"`).join(' ou ');
        return {
          text: `Encontrei mais de uma conta correspondente (${names}). Qual delas você deseja alterar?`,
          isInternalCalculation: true,
        };
      }

      const targetBill = billSearch.match;
      if (!targetBill) {
        return {
          text: `Não encontrei a conta "${d.name || 'solicitada'}" para alterar. Verifique o nome na lista de faturas.`,
          isInternalCalculation: true,
        };
      }

      const partial: Partial<BillItem> = {};
      const updatesDesc: string[] = [];

      const targetMonth = d.targetMonth || currentMonthStr;
      if (d.dueDay !== undefined && !isNaN(parseInt(String(d.dueDay), 10))) {
        const day = Math.min(31, Math.max(1, parseInt(String(d.dueDay), 10)));
        partial.dueDay = day;
        partial.dueDate = getEffectiveDateForMonth(targetMonth, day);
        updatesDesc.push(`vencimento para o dia ${day}`);
      }

      if (d.amount !== undefined && !isNaN(parseFloat(String(d.amount)))) {
        const amt = parseFloat(String(d.amount));
        partial.amount = amt;
        updatesDesc.push(`valor para ${formatCurrencySpoken(amt, currency)}`);
      }

      if (d.newName) {
        partial.name = d.newName;
        updatesDesc.push(`nome para "${d.newName}"`);
      }

      if (d.category) {
        partial.category = d.category;
      }

      if (Object.keys(partial).length === 0) {
        return {
          text: `Quais dados da conta "${targetBill.name}" você deseja alterar (vencimento ou valor)?`,
          isInternalCalculation: true,
        };
      }

      try {
        await handlers.onUpdateBill(targetBill.id, partial);
        const finalDesc = updatesDesc.length > 0 ? updatesDesc.join(' e ') : 'dados atualizados';
        return {
          text: parsed.directResponse || `${targetBill.name}: ${finalDesc} com sucesso.`,
          isInternalCalculation: true,
          actionExecuted: 'update_bill',
          createdItem: {
            type: 'bill',
            id: targetBill.id,
            name: partial.name || targetBill.name,
            amount: partial.amount !== undefined ? partial.amount : targetBill.amount,
          },
        };
      } catch (err: any) {
        console.error('Error executing onUpdateBill in Firestore:', err);
        return {
          text: `Erro ao salvar a alteração no banco de dados: ${err?.message || 'Falha de comunicação'}. A conta não foi alterada.`,
          isInternalCalculation: true,
        };
      }
    }

    // 6. UPDATE EXPENSE
    if (intent === 'update_expense') {
      if (!handlers?.onUpdateExpense) {
        return {
          text: 'Manipulador de atualização de despesa indisponível.',
          isInternalCalculation: true,
        };
      }

      const expSearch = findMatchingExpense(expenses, d.name, d.matchedId, lastActionItem, question);
      if (expSearch.ambiguous && expSearch.ambiguous.length > 1) {
        const names = expSearch.ambiguous.map((e) => `"${e.name}"`).join(' ou ');
        return {
          text: `Encontrei mais de uma despesa correspondente (${names}). Qual delas você deseja alterar?`,
          isInternalCalculation: true,
        };
      }

      const targetExpense = expSearch.match;
      if (!targetExpense) {
        return {
          text: `Não encontrei a despesa "${d.name || 'solicitada'}" para alterar.`,
          isInternalCalculation: true,
        };
      }

      const partial: Partial<ExpenseItem> = {};
      if (d.amount !== undefined && !isNaN(parseFloat(String(d.amount)))) {
        partial.amount = parseFloat(String(d.amount));
      }
      if (d.newName) partial.name = d.newName;
      if (d.category) partial.category = d.category;
      if (d.date) partial.date = d.date;

      try {
        await handlers.onUpdateExpense(targetExpense.id, partial);
        return {
          text: parsed.directResponse || `Despesa de ${partial.name || targetExpense.name} alterada para ${formatCurrencySpoken(partial.amount ?? targetExpense.amount, currency)}.`,
          isInternalCalculation: true,
          actionExecuted: 'update_expense',
          createdItem: {
            type: 'expense',
            id: targetExpense.id,
            name: partial.name || targetExpense.name,
            amount: partial.amount ?? targetExpense.amount,
          },
        };
      } catch (err: any) {
        console.error('Error executing onUpdateExpense in Firestore:', err);
        return {
          text: `Erro ao salvar a alteração da despesa no banco de dados: ${err?.message || 'Falha na gravação'}. O registro não foi alterado.`,
          isInternalCalculation: true,
        };
      }
    }

    // 7. UPDATE INCOME
    if (intent === 'update_income') {
      if (!handlers?.onUpdateIncome) {
        return {
          text: 'Manipulador de atualização de receita indisponível.',
          isInternalCalculation: true,
        };
      }

      const incSearch = findMatchingIncome(incomes, d.name, d.matchedId, lastActionItem, question);
      if (incSearch.ambiguous && incSearch.ambiguous.length > 1) {
        const names = incSearch.ambiguous.map((i) => `"${i.name}"`).join(' ou ');
        return {
          text: `Encontrei mais de uma receita correspondente (${names}). Qual delas você deseja alterar?`,
          isInternalCalculation: true,
        };
      }

      const targetIncome = incSearch.match;
      if (!targetIncome) {
        return {
          text: `Não encontrei a receita "${d.name || 'solicitada'}" para alterar.`,
          isInternalCalculation: true,
        };
      }

      const partial: Partial<IncomeItem> = {};
      if (d.amount !== undefined && !isNaN(parseFloat(String(d.amount)))) {
        partial.amount = parseFloat(String(d.amount));
      }
      if (d.newName) partial.name = d.newName;
      if (d.category) partial.category = d.category;
      if (d.expectedDay) {
        const day = parseInt(String(d.expectedDay), 10);
        partial.expectedDay = day;
        partial.expectedDate = getEffectiveDateForMonth(currentMonthStr, day);
      }

      try {
        await handlers.onUpdateIncome(targetIncome.id, partial);
        return {
          text: parsed.directResponse || `Receita de ${partial.name || targetIncome.name} alterada para ${formatCurrencySpoken(partial.amount ?? targetIncome.amount, currency)}.`,
          isInternalCalculation: true,
          actionExecuted: 'update_income',
          createdItem: {
            type: 'income',
            id: targetIncome.id,
            name: partial.name || targetIncome.name,
            amount: partial.amount ?? targetIncome.amount,
          },
        };
      } catch (err: any) {
        console.error('Error executing onUpdateIncome in Firestore:', err);
        return {
          text: `Erro ao salvar a alteração da receita no banco de dados: ${err?.message || 'Falha na gravação'}. O registro não foi alterado.`,
          isInternalCalculation: true,
        };
      }
    }

    // 8. MARK BILL PAID
    if (intent === 'mark_bill_paid' && handlers?.onToggleBillPaid) {
      const targetName = normalize(d.name || '');
      const billSearch = findMatchingBill(bills, d.name, d.matchedBillId || d.matchedId, question);
      if (billSearch.ambiguous && billSearch.ambiguous.length > 1) {
        return {
          text: `Encontrei mais de uma conta correspondente (${billSearch.ambiguous.map((b) => `"${b.name}"`).join(' ou ')}). Qual delas você pagou?`,
          isInternalCalculation: true,
        };
      }
      const matched = billSearch.match;
      if (!matched) {
        return {
          text: `Não consegui identificar qual conta você pagou. Diga o nome exato da fatura para eu não marcar a conta errada.`,
          isInternalCalculation: true,
        };
      }
      if (matched) {
        try {
          const targetM = d.targetMonth || currentMonthStr;
          await handlers.onToggleBillPaid(matched.id, targetM, true);
          return {
            text: `Pronto. ${matched.name} marcada como paga.`,
            isInternalCalculation: true,
            actionExecuted: 'mark_paid',
          };
        } catch (err: any) {
          console.error('Error in onToggleBillPaid:', err);
          return {
            text: `Erro ao marcar a conta como paga no banco de dados: ${err?.message || 'Falha'}. Nenhuma alteração foi realizada.`,
            isInternalCalculation: true,
          };
        }
      }
    }

    // Mark a scheduled income as received only when the user clearly identifies it.
    if (intent === 'mark_income_received' && handlers?.onToggleIncomeReceived) {
      const incomeSearch = findMatchingIncome(incomes, d.name, d.matchedId, lastActionItem, question);
      if (incomeSearch.ambiguous && incomeSearch.ambiguous.length > 1) {
        return {
          text: `Encontrei mais de uma receita correspondente (${incomeSearch.ambiguous.map((item) => `"${item.name}"`).join(' ou ')}). Qual delas você recebeu?`,
          isInternalCalculation: true,
        };
      }
      if (!incomeSearch.match) {
        return {
          text: 'Não consegui identificar qual receita você recebeu. Diga o nome da receita para eu não marcar a errada.',
          isInternalCalculation: true,
        };
      }
      const targetMonth = d.targetMonth || currentMonthStr;
      try {
        await handlers.onToggleIncomeReceived(incomeSearch.match.id, targetMonth, true);
        return {
          text: `Pronto. ${incomeSearch.match.name} marcada como recebida.`,
          isInternalCalculation: true,
          actionExecuted: 'mark_income_received',
          createdItem: { type: 'income', id: incomeSearch.match.id, name: incomeSearch.match.name, amount: incomeSearch.match.amount },
        };
      } catch (err: any) {
        return {
          text: `Não consegui marcar a receita como recebida: ${err?.message || 'falha ao salvar'}.`,
          isInternalCalculation: true,
        };
      }
    }

    // 9. CORRECTION (e.g. "Na verdade foi 3000, não 2500")
    if (intent === 'correct_last_item' && d.newAmount) {
      if (lastActionItem) {
        try {
          if (lastActionItem.type === 'expense' && handlers?.onUpdateExpense) {
            await handlers.onUpdateExpense(lastActionItem.id, { amount: d.newAmount });
          } else if (lastActionItem.type === 'bill' && handlers?.onUpdateBill) {
            await handlers.onUpdateBill(lastActionItem.id, { amount: d.newAmount });
          } else if (lastActionItem.type === 'income' && handlers?.onUpdateIncome) {
            await handlers.onUpdateIncome(lastActionItem.id, { amount: d.newAmount });
          }
          return {
            text: parsed.directResponse || `Corrigido. Valor alterado para ${formatCurrencySpoken(d.newAmount, currency)}.`,
            isInternalCalculation: true,
            actionExecuted: 'correction',
            createdItem: { ...lastActionItem, amount: d.newAmount },
          };
        } catch (err: any) {
          console.error('Error in correct_last_item:', err);
          return {
            text: `Erro ao salvar a correção no banco de dados: ${err?.message || 'Falha'}. O registro não foi alterado.`,
            isInternalCalculation: true,
          };
        }
      }
    }

    // 10. DELETE ITEM
    if (intent === 'delete_item') {
      let targetType: 'bill' | 'expense' | 'income' | null = d.itemType || null;
      let targetId: string | null = d.matchedId || null;
      let targetName: string = d.name || '';

      // Use the last created item only for an explicit pronoun/reference with no named target.
      if (!targetId && !targetName && lastActionItem) {
        targetType = lastActionItem.type;
        targetId = lastActionItem.id;
        targetName = lastActionItem.name;
      }

      if (!targetId && targetName) {
        const billSearch = findMatchingBill(bills, targetName, undefined, question);
        const expSearch = findMatchingExpense(expenses, targetName, undefined, lastActionItem, question);
        const incSearch = findMatchingIncome(incomes, targetName, undefined, lastActionItem, question);
        const candidates = [
          ...(billSearch.match ? [{ type: 'bill' as const, item: billSearch.match }] : []),
          ...(expSearch.match ? [{ type: 'expense' as const, item: expSearch.match }] : []),
          ...(incSearch.match ? [{ type: 'income' as const, item: incSearch.match }] : []),
        ];
        const ambiguous = billSearch.ambiguous?.length || expSearch.ambiguous?.length || incSearch.ambiguous?.length || candidates.length > 1;
        if (ambiguous) {
          const names = [
            ...(billSearch.ambiguous || []).map((item) => item.name),
            ...(expSearch.ambiguous || []).map((item) => item.name),
            ...(incSearch.ambiguous || []).map((item) => item.name),
            ...candidates.map((candidate) => candidate.item.name),
          ];
          return {
            text: `Encontrei mais de um registro que pode corresponder a "${targetName}". Qual deles você deseja excluir? ${[...new Set(names)].map((name) => `"${name}"`).join(' ou ')}.`,
            isInternalCalculation: true,
          };
        }
        if (candidates.length === 1) {
          targetType = candidates[0].type;
          targetId = candidates[0].item.id;
          targetName = candidates[0].item.name;
        }
      }

      if (!targetId || !targetType) {
        return {
          text: `Não encontrei o registro "${targetName || 'solicitado'}" para excluir.`,
          isInternalCalculation: true,
        };
      }

      try {
        if (targetType === 'bill' && handlers?.onDeleteBill) {
          await handlers.onDeleteBill(targetId);
        } else if (targetType === 'expense' && handlers?.onDeleteExpense) {
          await handlers.onDeleteExpense(targetId);
        } else if (targetType === 'income' && handlers?.onDeleteIncome) {
          await handlers.onDeleteIncome(targetId);
        } else {
          return {
            text: 'Manipulador de exclusão indisponível.',
            isInternalCalculation: true,
          };
        }

        return {
          text: parsed.directResponse || `Registro de "${targetName}" excluído com sucesso.`,
          isInternalCalculation: true,
          actionExecuted: 'delete_item',
        };
      } catch (err: any) {
        console.error('Error deleting item from Firestore:', err);
        return {
          text: `Erro ao excluir o registro do banco de dados: ${err?.message || 'Falha de comunicação'}. Nenhuma alteração foi realizada.`,
          isInternalCalculation: true,
        };
      }
    }

    // 11. CREATE GOAL
    if (intent === 'create_goal' && d.targetAmount && handlers?.onCreateGoal) {
      try {
        const gTitle = d.title || 'Meta de Economia';
        await handlers.onCreateGoal({
          title: gTitle,
          targetAmount: d.targetAmount,
          initialValue: 10,
          currency,
          icon: '🎯',
        });
        return {
          text: parsed.directResponse || `Meta de economia '${gTitle}' de ${formatCurrencySpoken(d.targetAmount, currency)} criada.`,
          isInternalCalculation: true,
          actionExecuted: 'create_goal',
        };
      } catch (err: any) {
        console.error('Error in onCreateGoal:', err);
        return {
          text: `Erro ao criar meta no banco de dados: ${err?.message || 'Falha'}.`,
          isInternalCalculation: true,
        };
      }
    }

    // 9. QUERY BILLS
    if (intent === 'query_bills') {
      const targetMonth = d.targetMonth || extractTargetMonth(question, currentMonthStr);
      const data = calculateMonthFinancials(ctx, targetMonth);
      const monthName = formatMonthName(targetMonth, locale).split(' ')[0];
      const pendingBills = data.monthBills.filter((bill) => !bill.isCompleted && !bill.isRefund && !bill.isRefunded);

      if (pendingBills.length === 0) {
        return {
          text: `Não. Você não tem contas pendentes para pagar em ${monthName}.`,
          isInternalCalculation: true,
        };
      }

      // Never add amounts from different currencies. Group totals by linked account currency.
      const totalsByCurrency = new Map<CurrencyCode, number>();
      for (const bill of pendingBills) {
        totalsByCurrency.set(bill.currency, (totalsByCurrency.get(bill.currency) || 0) + bill.amount);
      }
      const totalSummary = [...totalsByCurrency.entries()]
        .map(([code, amount]) => formatCurrencySpoken(amount, code))
        .join(' + ');
      const lines = pendingBills.map((bill) =>
        `• ${bill.name}: ${formatCurrencySpoken(bill.amount, bill.currency)} (vencimento: ${bill.date})`
      );
      return {
        text: `Sim. Você tem ${totalSummary} em contas pendentes para pagar em ${monthName}:\n${lines.join('\n')}`,
        isInternalCalculation: true,
      };
    }

    // UPDATE AN EXISTING SAVINGS GOAL.
    if (intent === 'update_goal') {
      if (!handlers?.onUpdateGoal) {
        return { text: 'A edição de metas não está disponível neste momento.', isInternalCalculation: true };
      }
      const goalName = normalize(d.goalName || d.name || '');
      const matches = (ctx.goals || []).filter((goal) =>
        d.goalId ? goal.id === d.goalId : Boolean(goalName && normalize(goal.title).includes(goalName))
      );
      if (matches.length !== 1) {
        return {
          text: matches.length > 1
            ? 'Encontrei mais de uma meta com esse nome. Qual delas você quer editar?'
            : 'Qual meta você quer editar? Diga o nome dela.',
          isInternalCalculation: true,
        };
      }
      const goal = matches[0];
      const partial: { title?: string; icon?: string; notes?: string } = {};
      if (typeof d.newName === 'string' && d.newName.trim()) partial.title = d.newName.trim();
      if (typeof d.icon === 'string' && d.icon.trim()) partial.icon = d.icon.trim();
      if (typeof d.notes === 'string' && d.notes.trim()) partial.notes = d.notes.trim();
      if (!Object.keys(partial).length) {
        return { text: 'O que você deseja mudar nessa meta: nome, ícone ou observação?', isInternalCalculation: true };
      }
      try {
        await handlers.onUpdateGoal(goal.id, partial);
        return {
          text: parsed.directResponse || `Atualizei a meta "${goal.title}".`,
          isInternalCalculation: true,
          actionExecuted: 'update_goal',
        };
      } catch (err: any) {
        return { text: `Não consegui atualizar a meta: ${err?.message || 'falha ao salvar'}.`, isInternalCalculation: true };
      }
    }

    // DELETE A SAVINGS GOAL.
    if (intent === 'delete_goal') {
      if (!handlers?.onDeleteGoal) {
        return { text: 'A exclusão de metas não está disponível neste momento.', isInternalCalculation: true };
      }
      const goalName = normalize(d.goalName || d.name || '');
      const matches = (ctx.goals || []).filter((goal) =>
        d.goalId ? goal.id === d.goalId : Boolean(goalName && normalize(goal.title).includes(goalName))
      );
      if (matches.length !== 1) {
        return {
          text: matches.length > 1
            ? 'Encontrei mais de uma meta com esse nome. Qual delas você quer excluir?'
            : 'Qual meta você quer excluir? Diga o nome dela.',
          isInternalCalculation: true,
        };
      }
      try {
        await handlers.onDeleteGoal(matches[0].id);
        return {
          text: parsed.directResponse || `A meta "${matches[0].title}" foi excluída.`,
          isInternalCalculation: true,
          actionExecuted: 'delete_goal',
        };
      } catch (err: any) {
        return { text: `Não consegui excluir a meta: ${err?.message || 'falha ao salvar'}.`, isInternalCalculation: true };
      }
    }

    // 10. QUERY SPENDING: separate recorded expenses from scheduled bills.
    if (intent === 'query_spending') {
      const targetMonth = d.targetMonth || extractTargetMonth(question, currentMonthStr);
      const data = calculateMonthFinancials(ctx, targetMonth);
      const monthName = formatMonthName(targetMonth, locale).split(' ')[0];
      const requestedCategory = normalize(d.category || d.categoryName || '');
      const selectedExpenses = data.monthExpenses.filter((item) =>
        !requestedCategory || normalize(item.category || '').includes(requestedCategory)
      );
      const selectedBills = data.monthBills.filter((item) =>
        !item.isRefund && !item.isRefunded &&
        (!requestedCategory || normalize(item.category || '').includes(requestedCategory))
      );
      const expenseTotals = new Map<CurrencyCode, number>();
      const billTotals = new Map<CurrencyCode, number>();
      for (const item of selectedExpenses) {
        expenseTotals.set(item.currency, (expenseTotals.get(item.currency) || 0) + item.amount);
      }
      for (const item of selectedBills) {
        billTotals.set(item.currency, (billTotals.get(item.currency) || 0) + item.amount);
      }
      const expenseSummary = formatCurrencyBreakdown(expenseTotals, 'nenhuma despesa registrada');
      const billSummary = formatCurrencyBreakdown(billTotals, 'nenhuma conta prevista');
      const categoryLabel = requestedCategory ? ` na categoria ${d.category || d.categoryName}` : '';
      return {
        text: `Em ${monthName}${categoryLabel}, você tem ${expenseSummary} em despesas registradas e ${billSummary} em contas previstas.`,
        isInternalCalculation: true,
      };
    }

    // 11. QUERY FORECAST
    if (intent === 'query_forecast') {
      const targetMonth = d.targetMonth || extractTargetMonth(question, currentMonthStr);
      if (targetMonth !== currentMonthStr && handlers?.onViewForecastMonth) {
        await handlers.onViewForecastMonth(targetMonth);
      }
      const data = calculateMonthFinancials(ctx, targetMonth);
      const monthName = formatMonthName(targetMonth, locale).split(' ')[0];
      const projected = formatCurrencyBreakdown(data.projectedBalanceByCurrency);
      return {
        text: `A previsão de saldo para ${monthName} é ${projected}.`,
        isInternalCalculation: true,
      };
    }

    // 10. QUERY INCOMES
    if (intent === 'query_incomes') {
      const targetMonth = d.targetMonth || extractTargetMonth(question, currentMonthStr);
      const data = calculateMonthFinancials(ctx, targetMonth);
      const totalsByCurrency = new Map<CurrencyCode, number>();
      for (const income of data.monthIncomes.filter((item) => !item.isCompleted && !item.isRefund && !item.isRefunded)) {
        totalsByCurrency.set(income.currency, (totalsByCurrency.get(income.currency) || 0) + income.amount);
      }
      const summary = [...totalsByCurrency.entries()]
        .map(([code, amount]) => formatCurrencySpoken(amount, code))
        .join(' + ');
      return {
        text: `${summary || 'Nenhuma receita prevista'} em receitas previstas.`,
        isInternalCalculation: true,
      };
    }

    // 11. QUERY BALANCE
    if (intent === 'query_balance') {
      const activeAccounts = (ctx.accounts || []).filter((account) => account.isActive !== false);
      if (activeAccounts.length) {
        const totals = new Map<CurrencyCode, number>();
        for (const account of activeAccounts) {
          const amount = Number(account.currentBalance ?? (account as any).balance ?? account.initialBalance ?? 0) || 0;
          totals.set(account.currency, (totals.get(account.currency) || 0) + amount);
        }
        const summary = [...totals.entries()].map(([code, amount]) => formatCurrencySpoken(amount, code)).join(' + ');
        return { text: `Seu saldo atual nas contas do SisFinz é ${summary}.`, isInternalCalculation: true };
      }
      return { text: `Seu saldo atual é de ${formatCurrencySpoken(currentBalance, currency)}.`, isInternalCalculation: true };
    }

    // QUERY ONE SPECIFIC ACCOUNT BALANCE.
    if (intent === 'query_account_balance') {
      const accountName = normalize(d.accountName || d.name || '');
      const matches = (ctx.accounts || []).filter((account) =>
        d.accountId ? account.id === d.accountId : Boolean(accountName && normalize(account.name).includes(accountName))
      );
      if (matches.length !== 1) {
        return {
          text: matches.length > 1
            ? 'Encontrei mais de uma conta com esse nome. Qual delas você quer consultar?'
            : 'Qual conta você quer consultar? Diga o nome dela como aparece no SisFinz.',
          isInternalCalculation: true,
        };
      }
      const account = matches[0];
      return {
        text: `A conta ${account.name} tem ${formatCurrencySpoken(account.currentBalance || 0, account.currency)} disponíveis.`,
        isInternalCalculation: true,
      };
    }

    // CREATE A SHARED BILL WITH AN EXISTING CONNECTED PARTNER.
    if (intent === 'create_shared_bill') {
      if (!handlers?.onCreateSharedBill) return { text: 'A criação de contas compartilhadas não está disponível.', isInternalCalculation: true };
      const title = String(d.title || d.name || '').trim();
      if (!title) return { text: 'Qual é o nome dessa conta compartilhada?', isInternalCalculation: true };
      const amount = Number(d.amount);
      if (!Number.isFinite(amount) || amount <= 0) return { text: 'Qual é o valor total da conta compartilhada?', isInternalCalculation: true };
      const dueDay = Number(d.dueDay);
      if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) return { text: 'Qual é o dia de vencimento dessa conta?', isInternalCalculation: true };
      const partners = ctx.sharedPartners || [];
      const partnerName = normalize(d.partnerName || '');
      const partnerMatches = partners.filter((partner) =>
        d.partnerId ? partner.uid === d.partnerId : Boolean(partnerName && (
          normalize(partner.displayName).includes(partnerName) || normalize(partner.email || '').includes(partnerName)
        ))
      );
      const partner = d.partnerId ? partnerMatches[0] : partnerName ? (partnerMatches.length === 1 ? partnerMatches[0] : undefined) : partners.length === 1 ? partners[0] : undefined;
      if (!partner) {
        return { text: partners.length > 1 ? 'Com qual pessoa conectada você quer compartilhar essa conta?' : 'Você ainda não tem uma pessoa conectada em Contas Compartilhadas. Primeiro conecte a pessoa no SisFinz.', isInternalCalculation: true };
      }
      const previous = (ctx.sharedBills || [])
        .filter((bill) => bill.members.includes(ctx.myUserId || '') && bill.members.includes(partner.uid))
        .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt))[0];
      const hasMyPercentage = d.myPercentage !== undefined && d.myPercentage !== null && Number.isFinite(Number(d.myPercentage));
      const hasPartnerPercentage = d.partnerPercentage !== undefined && d.partnerPercentage !== null && Number.isFinite(Number(d.partnerPercentage));
      const myPercentage = hasMyPercentage
        ? Number(d.myPercentage)
        : Number(previous?.percentages?.[ctx.myUserId || ''] ?? 50);
      const partnerPercentage = hasPartnerPercentage ? Number(d.partnerPercentage) : 100 - myPercentage;
      if (myPercentage < 0 || partnerPercentage < 0 || myPercentage + partnerPercentage !== 100) {
        return { text: 'Como você quer dividir a conta em porcentagens? A soma precisa ser 100%.', isInternalCalculation: true };
      }
      const splitMethod: SplitMethod = myPercentage === 50 && partnerPercentage === 50 ? 'fifty_fifty' : 'custom_percentage';
      const startMonth = d.targetMonth || currentMonthStr;
      const dueDate = d.dueDate || getEffectiveDateForMonth(startMonth, dueDay);
      try {
        await handlers.onCreateSharedBill({
          title, amount, dueDate, dueDay, category: d.category || 'Outros',
          ...(d.notes ? { notes: d.notes } : {}),
          partnerId: partner.uid, splitMethod, myPercentage, partnerPercentage,
          recurrence: d.isRecurring === true ? 'monthly' : 'none',
          ...(d.recurrenceMonthsCount ? { recurrenceMonthsCount: Number(d.recurrenceMonthsCount) } : {}),
        });
        const myShare = Math.round((amount * myPercentage) / 100);
        return {
          text: `Criei a conta compartilhada "${title}" de ${formatCurrencySpoken(amount, currency)} com ${partner.displayName}. Sua parte é ${formatCurrencySpoken(myShare, currency)} (${myPercentage}%) e a parte de ${partner.displayName} é ${formatCurrencySpoken(amount - myShare, currency)} (${partnerPercentage}%).`,
          isInternalCalculation: true, actionExecuted: 'create_shared_bill',
        };
      } catch (err: any) {
        return { text: `Não consegui criar a conta compartilhada: ${err?.message || 'falha ao salvar'}.`, isInternalCalculation: true };
      }
    }

    // UPDATE A SHARED BILL.
    if (intent === 'update_shared_bill') {
      if (!handlers?.onUpdateSharedBill) return { text: 'A edição de contas compartilhadas não está disponível.', isInternalCalculation: true };
      const target = normalize(d.name || d.title || '');
      const matches = (ctx.sharedBills || []).filter((bill) =>
        d.matchedId ? bill.id === d.matchedId : Boolean(target && normalize(bill.title).includes(target))
      );
      if (matches.length !== 1) return { text: matches.length > 1 ? 'Encontrei mais de uma conta compartilhada com esse nome. Qual delas?' : 'Qual conta compartilhada você quer alterar?', isInternalCalculation: true };
      const bill = matches[0];
      const myId = ctx.myUserId || '';
      const partnerId = bill.members.find((memberId) => memberId !== myId);
      const myPercentage = d.myPercentage !== undefined && d.myPercentage !== null && Number.isFinite(Number(d.myPercentage))
        ? Number(d.myPercentage) : Number(bill.percentages[myId] ?? 50);
      const partnerPercentage = d.partnerPercentage !== undefined && d.partnerPercentage !== null && Number.isFinite(Number(d.partnerPercentage))
        ? Number(d.partnerPercentage) : 100 - myPercentage;
      if (myPercentage < 0 || partnerPercentage < 0 || myPercentage + partnerPercentage !== 100) {
        return { text: 'As porcentagens da divisão precisam somar 100%. Como você quer dividir?', isInternalCalculation: true };
      }
      const dueDay = Number(d.dueDay || bill.dueDay);
      const dueDate = d.dueDate || getEffectiveDateForMonth(d.targetMonth || bill.month, dueDay);
      try {
        await handlers.onUpdateSharedBill(bill.id, {
          title: String(d.newName || d.title || bill.title),
          amount: Number(d.newAmount || d.amount || bill.amount),
          dueDate, dueDay,
          category: d.category || bill.category || 'Outros',
          ...(d.notes !== undefined ? { notes: d.notes } : { notes: bill.notes }),
          splitMethod: myPercentage === 50 && partnerPercentage === 50 ? 'fifty_fifty' : 'custom_percentage',
          myPercentage, partnerPercentage,
        });
        return { text: `Atualizei a conta compartilhada "${bill.title}".`, isInternalCalculation: true, actionExecuted: 'update_shared_bill' };
      } catch (err: any) {
        return { text: `Não consegui atualizar a conta compartilhada: ${err?.message || 'falha ao salvar'}.`, isInternalCalculation: true };
      }
    }

    // DELETE A SHARED BILL. Mone's chat confirmation replaces the browser confirm dialog.
    if (intent === 'delete_shared_bill') {
      if (!handlers?.onDeleteSharedBill) return { text: 'A exclusão de contas compartilhadas não está disponível.', isInternalCalculation: true };
      const target = normalize(d.name || d.title || '');
      const matches = (ctx.sharedBills || []).filter((bill) =>
        d.matchedId ? bill.id === d.matchedId : Boolean(target && normalize(bill.title).includes(target))
      );
      if (matches.length !== 1) return { text: matches.length > 1 ? 'Encontrei mais de uma conta compartilhada com esse nome. Qual delas?' : 'Qual conta compartilhada você quer excluir?', isInternalCalculation: true };
      try {
        await handlers.onDeleteSharedBill(matches[0].id);
        return { text: `A conta compartilhada "${matches[0].title}" foi excluída ou ocultada da sua lista.`, isInternalCalculation: true, actionExecuted: 'delete_shared_bill' };
      } catch (err: any) {
        return { text: `Não consegui excluir a conta compartilhada: ${err?.message || 'falha ao salvar'}.`, isInternalCalculation: true };
      }
    }

    // QUERY THE USER'S OWN SHARE OF SHARED BILLS.
    if (intent === 'query_shared_bills') {
      const targetMonth = d.targetMonth || currentMonthStr;
      const name = normalize(d.name || '');
      const shared = (ctx.sharedBills || []).filter((bill) => {
        const isRecurringOccurrence = bill.recurrence === 'monthly' &&
          Boolean(bill.startMonth && bill.startMonth <= targetMonth) &&
          !(bill.excludedMonths || []).includes(targetMonth) &&
          !bill.exceptions?.[targetMonth]?.isDeleted;
        const inMonth = bill.month === targetMonth || (bill.dueDate || '').startsWith(targetMonth) || isRecurringOccurrence;
        const nameMatches = !name || normalize(bill.title).includes(name);
        const notExcludedForMonth = !(bill.excludedMonths || []).includes(targetMonth);
        const notDeletedForUser = !ctx.myUserId || !(bill.exceptions?.[targetMonth]?.deletedForUsers || []).includes(ctx.myUserId);
        return inMonth && notExcludedForMonth && notDeletedForUser &&
          bill.shareRequest?.status !== 'rejected' &&
          nameMatches && (!ctx.myUserId || bill.members.includes(ctx.myUserId));
      });
      if (!shared.length) {
        return { text: 'Não encontrei contas compartilhadas suas para esse período.', isInternalCalculation: true };
      }
      const lines = shared.map((bill) => {
        const monthOverride: Partial<SharedBill> = bill.exceptions?.[targetMonth] || {};
        const shareMap = monthOverride.shares || bill.shares;
        const share = ctx.myUserId ? shareMap?.[ctx.myUserId] : undefined;
        const effectiveTitle = monthOverride.title || bill.title;
        const effectiveAmount = Number(monthOverride.amount) || bill.amount;
        return `• ${effectiveTitle}: sua parte ${formatCurrencySpoken(share?.amount || 0, currency)} de ${formatCurrencySpoken(effectiveAmount, currency)} — ${share?.status === 'paid' ? 'paga' : 'pendente'}`;
      });
      return {
        text: `Suas contas compartilhadas em ${targetMonth}:\n${lines.join('\n')}`,
        isInternalCalculation: true,
      };
    }

    // ACCOUNTS: query and manage the user's real SisFinz wallets.
    if (intent === 'query_accounts') {
      const accountList = ctx.accounts || [];
      if (!accountList.length) return { text: 'Não há contas cadastradas no SisFinz.', isInternalCalculation: true };
      const totals = new Map<CurrencyCode, number>();
      for (const account of accountList.filter((item) => item.isActive !== false)) {
        totals.set(account.currency, (totals.get(account.currency) || 0) + (Number(account.currentBalance) || 0));
      }
      const lines = accountList.map((account) =>
        `• ${account.name}: ${formatCurrencySpoken(Number(account.currentBalance) || 0, account.currency)} (${account.isActive === false ? 'inativa' : 'ativa'})`
      );
      return { text: `Suas contas ativas somam ${formatCurrencyBreakdown(totals, 'nenhum saldo em contas ativas')}.\n${lines.join('\n')}`, isInternalCalculation: true };
    }

    if (intent === 'create_account') {
      if (!handlers?.onAddAccount) return { text: 'A criação de contas não está disponível agora.', isInternalCalculation: true };
      const name = String(d.name || d.accountName || '').trim();
      if (!name) return { text: 'Qual nome você quer dar à nova conta?', isInternalCalculation: true };
      const validTypes: AccountType[] = ['bank', 'wallet', 'cash', 'safe', 'other'];
      const type = validTypes.includes(d.type) ? d.type : 'bank';
      const code = (['ARS', 'USD', 'BRL', 'EUR'].includes(d.currency) ? d.currency : currency) as CurrencyCode;
      if (d.initialBalance === undefined && d.currentBalance === undefined) {
        return { text: 'Qual é o saldo inicial dessa conta? Se ela estiver zerada, pode me dizer zero.', isInternalCalculation: true };
      }
      const initialBalance = Number(d.initialBalance ?? d.currentBalance);
      if (!Number.isFinite(initialBalance) || initialBalance < 0) return { text: 'Qual é o saldo inicial dessa conta?', isInternalCalculation: true };
      try {
        await handlers.onAddAccount({ name, type, currency: code, initialBalance, currentBalance: initialBalance, ...(d.notes ? { notes: d.notes } : {}) });
        return { text: `Criei a conta "${name}" com saldo inicial de ${formatCurrencySpoken(initialBalance, code)}.`, isInternalCalculation: true, actionExecuted: 'create_account' };
      } catch (err: any) {
        return { text: `Não consegui criar a conta: ${err?.message || 'falha ao salvar'}.`, isInternalCalculation: true };
      }
    }

    if (intent === 'update_account' || intent === 'delete_account' || intent === 'toggle_account_active') {
      const accountName = normalize(d.accountName || d.name || '');
      const matches = (ctx.accounts || []).filter((account) =>
        d.accountId ? account.id === d.accountId : Boolean(accountName && normalize(account.name).includes(accountName))
      );
      if (matches.length !== 1) {
        return { text: matches.length > 1 ? 'Encontrei mais de uma conta com esse nome. Qual delas?' : 'Qual conta você quer alterar?', isInternalCalculation: true };
      }
      const account = matches[0];
      try {
        if (intent === 'delete_account') {
          if (!handlers?.onDeleteAccount) return { text: 'A exclusão de contas não está disponível.', isInternalCalculation: true };
          await handlers.onDeleteAccount(account.id);
          return { text: `A conta "${account.name}" foi excluída.`, isInternalCalculation: true, actionExecuted: 'delete_account' };
        }
        if (intent === 'toggle_account_active') {
          if (!handlers?.onToggleAccountActive) return { text: 'A alteração do status da conta não está disponível.', isInternalCalculation: true };
          const desiredActive = typeof d.isActive === 'boolean' ? d.isActive : undefined;
          const currentlyActive = account.isActive !== false;
          if (desiredActive !== undefined && desiredActive === currentlyActive) {
            return { text: `A conta "${account.name}" já está ${currentlyActive ? 'ativa' : 'inativa'}.`, isInternalCalculation: true };
          }
          await handlers.onToggleAccountActive(account.id);
          return { text: `A conta "${account.name}" agora está ${currentlyActive ? 'inativa' : 'ativa'}.`, isInternalCalculation: true, actionExecuted: 'toggle_account_active' };
        }
        if (!handlers?.onUpdateAccount) return { text: 'A edição de contas não está disponível.', isInternalCalculation: true };
        const updates: Partial<AccountItem> & { currentBalance?: number } = {};
        if (typeof d.newName === 'string' && d.newName.trim()) updates.name = d.newName.trim();
        if (['ARS', 'USD', 'BRL', 'EUR'].includes(d.currency)) updates.currency = d.currency;
        if (['bank', 'wallet', 'cash', 'safe', 'other'].includes(d.type)) updates.type = d.type;
        if (typeof d.currentBalance === 'number' && Number.isFinite(d.currentBalance)) updates.currentBalance = d.currentBalance;
        if (typeof d.notes === 'string') updates.notes = d.notes;
        if (!Object.keys(updates).length) return { text: 'O que você quer mudar nessa conta: nome, moeda, tipo ou saldo?', isInternalCalculation: true };
        await handlers.onUpdateAccount(account.id, updates);
        return { text: `Atualizei a conta "${account.name}" com as alterações solicitadas.`, isInternalCalculation: true, actionExecuted: 'update_account' };
      } catch (err: any) {
        return { text: `Não consegui alterar a conta: ${err?.message || 'falha ao salvar'}.`, isInternalCalculation: true };
      }
    }

    // CUSTOM CATEGORIES: read and manage the categories configured in this SisFinz account.
    if (intent === 'query_categories') {
      const categories = ctx.categories || [];
      if (!categories.length) return { text: 'Não encontrei categorias cadastradas no SisFinz.', isInternalCalculation: true };
      const lines = categories.map((category) => `• ${category.name} (${category.scope})`);
      return { text: `Estas são as categorias disponíveis no seu SisFinz:\n${lines.join('\n')}`, isInternalCalculation: true };
    }

    if (intent === 'create_category') {
      if (!handlers?.onAddCategory) return { text: 'A criação de categorias não está disponível agora.', isInternalCalculation: true };
      const name = String(d.name || d.categoryName || '').trim();
      if (!name) return { text: 'Qual nome você quer dar à nova categoria?', isInternalCalculation: true };
      const allowedScopes = ['all', 'bill', 'income', 'expense'];
      const scope = allowedScopes.includes(d.scope) ? d.scope : 'all';
      try {
        await handlers.onAddCategory(name, scope);
        return { text: `Criei a categoria "${name}" no SisFinz.`, isInternalCalculation: true, actionExecuted: 'create_category' };
      } catch (err: any) {
        return { text: `Não consegui criar a categoria: ${err?.message || 'falha ao salvar'}.`, isInternalCalculation: true };
      }
    }

    if (intent === 'update_category' || intent === 'delete_category') {
      const categoryName = normalize(d.categoryName || d.name || '');
      const matches = (ctx.categories || []).filter((category) =>
        d.categoryId ? category.id === d.categoryId : Boolean(categoryName && normalize(category.name).includes(categoryName))
      );
      if (matches.length !== 1) {
        return { text: matches.length > 1 ? 'Encontrei mais de uma categoria com esse nome. Qual delas?' : 'Qual categoria você quer alterar?', isInternalCalculation: true };
      }
      try {
        if (intent === 'delete_category') {
          if (!handlers?.onDeleteCategory) return { text: 'A exclusão de categorias não está disponível.', isInternalCalculation: true };
          await handlers.onDeleteCategory(matches[0].id);
          return { text: `A categoria "${matches[0].name}" foi excluída das opções do SisFinz.`, isInternalCalculation: true, actionExecuted: 'delete_category' };
        }
        if (!handlers?.onUpdateCategory) return { text: 'A edição de categorias não está disponível.', isInternalCalculation: true };
        const updates: { name?: string; scope?: 'all' | 'bill' | 'income' | 'expense'; color?: string } = {};
        if (typeof d.newName === 'string' && d.newName.trim()) updates.name = d.newName.trim();
        if (['all', 'bill', 'income', 'expense'].includes(d.scope)) updates.scope = d.scope;
        if (!Object.keys(updates).length) return { text: 'O que você quer mudar nessa categoria: nome ou tipo?', isInternalCalculation: true };
        await handlers.onUpdateCategory(matches[0].id, updates);
        return { text: `Atualizei a categoria "${matches[0].name}".`, isInternalCalculation: true, actionExecuted: 'update_category' };
      } catch (err: any) {
        return { text: `Não consegui alterar a categoria: ${err?.message || 'falha ao salvar'}.`, isInternalCalculation: true };
      }
    }

    // SAVINGS JARS: read actual savings goals and transaction history.
    if (intent === 'query_savings' || intent === 'query_saving_transactions') {
      const requestedSavingName = normalize(d.savingName || d.name || '');
      const matchedSavings = (ctx.savings || []).filter((goal) =>
        d.savingId ? goal.id === d.savingId : !requestedSavingName || normalize(goal.name).includes(requestedSavingName)
      );
      if ((requestedSavingName || d.savingId) && matchedSavings.length !== 1) {
        return { text: matchedSavings.length > 1 ? 'Encontrei mais de um cofrinho com esse nome. Qual deles?' : 'Não encontrei esse cofrinho. Quer consultar a lista de todos?', isInternalCalculation: true };
      }
      const savingGoals = requestedSavingName || d.savingId ? matchedSavings : (ctx.savings || []);
      if (intent === 'query_saving_transactions') {
        const history = (ctx.savingTransactions || [])
          .filter((tx) => !savingGoals.length || savingGoals.some((goal) => goal.id === tx.savingId))
          .slice(0, 12);
        if (!history.length) return { text: 'Ainda não há movimentações registradas nos seus cofrinhos.', isInternalCalculation: true };
        const lines = history.map((tx) =>
          `• ${tx.type === 'deposit' ? 'Aporte' : 'Resgate'} — ${tx.savingName}: ${formatCurrencySpoken(tx.amount, tx.currency || currency)} em ${tx.date}`
        );
        return { text: `Últimas movimentações dos seus cofrinhos:\n${lines.join('\n')}`, isInternalCalculation: true };
      }
      if (!savingGoals.length) return { text: 'Você ainda não tem cofrinhos cadastrados no SisFinz.', isInternalCalculation: true };
      const totals = new Map<CurrencyCode, number>();
      for (const goal of savingGoals) {
        const code = goal.currency || currency;
        totals.set(code, (totals.get(code) || 0) + (Number(goal.currentAmount) || 0));
      }
      const totalSummary = formatCurrencyBreakdown(totals, 'nenhum valor guardado');
      const lines = savingGoals.map((goal) => {
        const code = goal.currency || currency;
        const saved = Number(goal.currentAmount) || 0;
        if (goal.hasTarget === false || !goal.targetAmount) {
          return `• ${goal.name}: ${formatCurrencySpoken(saved, code)} guardados, sem meta definida.`;
        }
        const remaining = Math.max(0, goal.targetAmount - saved);
        return `• ${goal.name}: ${formatCurrencySpoken(saved, code)} de ${formatCurrencySpoken(goal.targetAmount, code)}; faltam ${formatCurrencySpoken(remaining, code)}.`;
      });
      return { text: `Você tem ${totalSummary} guardados nos seus cofrinhos.\n${lines.join('\n')}`, isInternalCalculation: true };
    }

    // CREATE A SAVINGS JAR.
    if (intent === 'create_saving_goal') {
      if (!handlers?.onCreateSavingGoal) return { text: 'A criação de cofrinhos não está disponível neste momento.', isInternalCalculation: true };
      const name = String(d.name || d.savingName || '').trim();
      if (!name) return { text: 'Como você quer chamar esse cofrinho?', isInternalCalculation: true };
      const hasTarget = d.hasTarget !== false && d.withoutTarget !== true;
      const targetAmount = Number(d.targetAmount) || 0;
      if (hasTarget && targetAmount <= 0) return { text: `Qual é o valor da meta do cofrinho "${name}"? Ou prefere criar sem meta?`, isInternalCalculation: true };
      const code = (['ARS', 'USD', 'BRL', 'EUR'].includes(d.currency) ? d.currency : currency) as CurrencyCode;
      try {
        await handlers.onCreateSavingGoal({
          name, hasTarget, ...(hasTarget ? { targetAmount } : {}),
          currency: code, ...(d.deadline ? { deadline: d.deadline } : {}),
          icon: d.icon || '🎯', ...(d.notes ? { notes: d.notes } : {}),
        });
        return { text: `Pronto. Criei o cofrinho "${name}" ${hasTarget ? `com meta de ${formatCurrencySpoken(targetAmount, code)}` : 'sem meta definida'}.`, isInternalCalculation: true, actionExecuted: 'create_saving_goal' };
      } catch (err: any) {
        return { text: `Não consegui criar o cofrinho: ${err?.message || 'falha ao salvar'}.`, isInternalCalculation: true };
      }
    }

    // DEPOSIT INTO OR WITHDRAW FROM A SAVINGS JAR.
    if (intent === 'deposit_to_saving' || intent === 'withdraw_from_saving') {
      const savingName = normalize(d.savingName || d.name || '');
      const matches = (ctx.savings || []).filter((goal) =>
        d.savingId ? goal.id === d.savingId : Boolean(savingName && normalize(goal.name).includes(savingName))
      );
      if (matches.length !== 1) {
        return {
          text: matches.length > 1
            ? 'Encontrei mais de um cofrinho com esse nome. Qual deles você quer usar?'
            : 'Em qual cofrinho você quer fazer essa movimentação?',
          isInternalCalculation: true,
        };
      }
      const goal = matches[0];
      const amount = Number(d.amount);
      if (!Number.isFinite(amount) || amount <= 0) return { text: 'Qual valor você quer movimentar?', isInternalCalculation: true };
      const code = goal.currency || currency;
      const exchangeRate = code === 'ARS' ? 1 : Number(d.exchangeRate);
      if (code !== 'ARS' && (!Number.isFinite(exchangeRate) || exchangeRate <= 0)) {
        return { text: `Qual cotação em pesos argentinos por ${code === 'USD' ? 'dólar' : code === 'BRL' ? 'real' : 'euro'} devo usar?`, isInternalCalculation: true };
      }
      const handler = intent === 'deposit_to_saving' ? handlers?.onTransferToSaving : handlers?.onWithdrawFromSaving;
      if (!handler) return { text: 'Essa movimentação de cofrinho não está disponível neste momento.', isInternalCalculation: true };
      try {
        await handler(goal.id, amount, exchangeRate, d.date || todayStr, d.note);
        return {
          text: intent === 'deposit_to_saving'
            ? `Aporte de ${formatCurrencySpoken(amount, code)} realizado no cofrinho "${goal.name}".`
            : `Resgate de ${formatCurrencySpoken(amount, code)} realizado do cofrinho "${goal.name}".`,
          isInternalCalculation: true,
          actionExecuted: intent,
        };
      } catch (err: any) {
        return { text: `Não consegui concluir a movimentação: ${err?.message || 'falha ao salvar'}.`, isInternalCalculation: true };
      }
    }

    // UPDATE A SAVINGS JAR.
    if (intent === 'update_saving_goal') {
      if (!handlers?.onUpdateSavingGoal) return { text: 'A edição de cofrinhos não está disponível.', isInternalCalculation: true };
      const savingName = normalize(d.savingName || d.name || '');
      const matches = (ctx.savings || []).filter((goal) =>
        d.savingId ? goal.id === d.savingId : Boolean(savingName && normalize(goal.name).includes(savingName))
      );
      if (matches.length !== 1) {
        return { text: matches.length > 1 ? 'Encontrei mais de um cofrinho com esse nome. Qual você quer editar?' : 'Qual cofrinho você quer editar?', isInternalCalculation: true };
      }
      const updates: Partial<SavingGoal> = {};
      if (typeof d.newName === 'string' && d.newName.trim()) updates.name = d.newName.trim();
      if (typeof d.targetAmount === 'number' && d.targetAmount > 0) {
        updates.targetAmount = d.targetAmount;
        updates.hasTarget = true;
      }
      if (d.hasTarget === false || d.withoutTarget === true) {
        updates.hasTarget = false;
        updates.targetAmount = undefined;
        updates.deadline = undefined;
      }
      if (typeof d.deadline === 'string') updates.deadline = d.deadline;
      if (typeof d.notes === 'string') updates.notes = d.notes;
      if (!Object.keys(updates).length) return { text: 'O que você quer mudar nesse cofrinho: nome, meta, prazo ou observações?', isInternalCalculation: true };
      try {
        await handlers.onUpdateSavingGoal(matches[0].id, updates);
        return { text: `Atualizei o cofrinho "${matches[0].name}" com as alterações solicitadas.`, isInternalCalculation: true, actionExecuted: 'update_saving_goal' };
      } catch (err: any) {
        return { text: `Não consegui atualizar o cofrinho: ${err?.message || 'falha ao salvar'}.`, isInternalCalculation: true };
      }
    }

    // DELETE A SAVINGS JAR.
    if (intent === 'delete_saving_goal') {
      if (!handlers?.onDeleteSavingGoal) return { text: 'A exclusão de cofrinhos não está disponível.', isInternalCalculation: true };
      const savingName = normalize(d.savingName || d.name || '');
      const matches = (ctx.savings || []).filter((goal) =>
        d.savingId ? goal.id === d.savingId : Boolean(savingName && normalize(goal.name).includes(savingName))
      );
      if (matches.length !== 1) {
        return { text: matches.length > 1 ? 'Encontrei mais de um cofrinho com esse nome. Qual você quer excluir?' : 'Qual cofrinho você quer excluir?', isInternalCalculation: true };
      }
      try {
        await handlers.onDeleteSavingGoal(matches[0].id);
        return { text: `O cofrinho "${matches[0].name}" foi excluído.`, isInternalCalculation: true, actionExecuted: 'delete_saving_goal' };
      } catch (err: any) {
        return { text: `Não consegui excluir o cofrinho: ${err?.message || 'falha ao salvar'}.`, isInternalCalculation: true };
      }
    }

    // QUERY SAVINGS GOAL PROGRESS.
    if (intent === 'query_goal_progress') {
      const goalName = normalize(d.goalName || d.name || '');
      const matches = (ctx.goals || []).filter((goal) =>
        d.goalId ? goal.id === d.goalId : Boolean(goalName && normalize(goal.title).includes(goalName))
      );
      const selectedGoals = goalName || d.goalId ? matches : (ctx.goals || []);
      if (!selectedGoals.length) {
        return { text: 'Você ainda não tem metas de economia cadastradas.', isInternalCalculation: true };
      }
      const lines = selectedGoals.map((goal) => {
        const saved = (goal.history || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        const target = Number(goal.totalTarget || goal.targetAmount) || 0;
        const remaining = Math.max(0, target - saved);
        return `• ${goal.title}: ${formatCurrencySpoken(saved, goal.currency || currency)} guardados de ${formatCurrencySpoken(target, goal.currency || currency)}; faltam ${formatCurrencySpoken(remaining, goal.currency || currency)}.`;
      });
      return {
        text: lines.length === 1 ? lines[0] : `Progresso das suas metas:\n${lines.join('\n')}`,
        isInternalCalculation: true,
      };
    }

    // QUERY SAVINGS CHALLENGE PROGRESS.
    if (intent === 'query_weekly_challenge') {
      const challengeName = normalize(d.challengeName || d.name || '');
      const matches = (ctx.weeklyChallenges || []).filter((challenge) =>
        d.challengeId ? challenge.id === d.challengeId : Boolean(challengeName && normalize(challenge.title).includes(challengeName))
      );
      if (matches.length !== 1) {
        return {
          text: matches.length > 1
            ? 'Encontrei mais de um desafio semanal. Qual deles você quer consultar?'
            : 'Qual desafio semanal você quer consultar? Diga o nome do plano.',
          isInternalCalculation: true,
        };
      }
      const challenge = matches[0];
      const totalWeeks = Math.max(1, Math.floor(challenge.totalWeeks || 52));
      const completed = [...(challenge.completedWeeks || [])].sort((a, b) => a - b);
      const fixedWeeklyAmount = Math.round((challenge.totalTarget / totalWeeks) * 100) / 100;
      const saved = (challenge.savingMode || 'progressive') === 'fixed'
        ? completed.reduce((sum, week) => sum + (week === totalWeeks
            ? Math.round((challenge.totalTarget - fixedWeeklyAmount * (totalWeeks - 1)) * 100) / 100
            : fixedWeeklyAmount), 0)
        : completed.reduce((sum, week) => sum + challenge.initialAmount * week, 0);
      return {
        text: `O desafio "${challenge.title}" está em ${completed.length} de ${totalWeeks} semanas. Você já separou ${formatCurrencySpoken(saved, challenge.currency || currency)} e faltam ${totalWeeks - completed.length} semanas.`,
        isInternalCalculation: true,
      };
    }

    // 12. DIRECT RESPONSE / CLARIFICATION
    if (parsed.directResponse) {
      return {
        text: parsed.directResponse,
        isInternalCalculation: true,
      };
    }

    return null;
  }

  // =========================================================================
  // A. ULTRA-FAST INSTANT DETERMINISTIC NLP (0ms Instant Response!)
  // =========================================================================

  // 1. Installment Purchase (e.g. "Comprei um tênis de 200 mil em 5 vezes", "compra de 200.000 em 5 parcelas")
  const isInstallment =
    /\b(?:comprei|adicionei|adicione|adicionar|crie|criar|registre|registrar|lancei|lancar)\b/i.test(norm) &&
    /\b(?:parcelas?|vezes|cuotas?)\b|\s+x\s+/i.test(norm);

  if (isInstallment && handlers?.onAddBill) {
    const countMatch = norm.match(/(\d+)\s*(?:parcelas?|vezes|cuotas?|x\b)/i);
    const installments = countMatch ? parseInt(countMatch[1], 10) : 0;
    const amountText = question
      .replace(/\b\d+\s*(?:parcelas?|vezes|cuotas?|x\b)/i, '')
      .replace(/\b(?:dia|todo dia|vencimento|vencendo)\s*\d{1,2}\b/i, '');
    const parsedAmt = parseAmountFromText(amountText);
    if (!parsedAmt || parsedAmt <= 0 || installments < 2 || installments > 120) {
      return {
        text: 'Para cadastrar a compra parcelada, preciso do valor total e da quantidade de parcelas. Por exemplo: “comprei um celular de 600.000 em 12 parcelas”. Ainda não cadastrei nada.',
        isInternalCalculation: true,
      };
    }
    const instAmount = Math.round((parsedAmt / installments) * 100) / 100;

    const dayMatch = norm.match(/(?:dia|todo dia|vencimento|vencendo)\s*(\d{1,2})/i);
    const dueDay = dayMatch ? Math.min(31, Math.max(1, parseInt(dayMatch[1], 10))) : new Date().getDate();

    const targetMonth = extractTargetMonth(question, currentMonthStr);

    let name = 'Compra parcelada';
    if (norm.includes('tenis') || norm.includes('tênis')) name = 'Compra de tênis';
    else if (norm.includes('celular') || norm.includes('iphone')) name = 'Celular';
    else if (norm.includes('notebook')) name = 'Notebook';
    else if (norm.includes('carro')) name = 'Carro';
    else if (norm.includes('moto')) name = 'Moto';

    const selectedAccount = resolveMoneAccount(context, undefined, context.accounts?.find((account) =>
      account.isActive !== false && norm.includes(normalize(account.name))
    )?.name);
    if (selectedAccount.needsChoice) {
      return { text: 'Em qual conta devo vincular as parcelas dessa compra?', isInternalCalculation: true };
    }
    const res = await handlers.onAddBill({
      name,
      amount: instAmount,
      dueDay,
      dueDate: getEffectiveDateForMonth(targetMonth, dueDay),
      category: 'Compras',
      recurrence: 'monthly',
      recurrenceMonthsCount: installments,
      startMonth: targetMonth,
      ...(selectedAccount.account ? { accountId: selectedAccount.account.id } : {}),
    });

    const createdId = res && typeof res === 'object' && res.id ? res.id : 'bill_' + Date.now();
    return {
      text: `Pronto. ${name} criada em ${installments} parcelas de ${formatCurrencySpoken(instAmount, currency)}, todo dia ${dueDay}.`,
      isInternalCalculation: true,
      actionExecuted: 'add_installment',
      createdItem: { type: 'bill', id: createdId, name, amount: instAmount },
    };
  }

  // 2. One-off Expense (e.g. "Gastei 2500 pesos de Uber agora", "adicione despesa de 4000 de uber hoje")
  const isExpense =
    /\b(?:gastei|comprei|adicionei|adicione|adicionar|registre|registrar|lancei|lancar|anotei|anotar)\b/i.test(norm);
  const requestsRecurrence = /\b(?:recorrente|repetir|repeticao|mensal|todo\s+mes|todos\s+os\s+meses|a\s+cada\s+mes)\b/i.test(norm);
  const hasExplicitDateOrMonth = /\b(?:ontem|anteontem|amanha|depois\s+de\s+amanha|dia\s+\d{1,2}|no\s+dia\s+\d{1,2}|proxim[oa]\s+m[eê]s|m[eê]s\s+que\s+vem|janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/i.test(norm);
  const hasExplicitCurrency = /\b(?:d[oó]lares?|usd|ars|pesos?|reais?|brl|eur|euros?)\b/i.test(norm);

  if (isExpense && !requestsRecurrence && !hasExplicitDateOrMonth && !hasExplicitCurrency && handlers?.onAddExpense) {
    const parsedAmt = parseAmountFromText(question);
    if (parsedAmt && parsedAmt > 0) {
      let name = 'Despesa';
      if (norm.includes('uber')) name = 'Uber';
      else if (norm.includes('mercado') || norm.includes('supermercado')) name = 'Mercado';
      else if (norm.includes('almoco') || norm.includes('almoço')) name = 'Almoço';
      else if (norm.includes('jantar')) name = 'Jantar';
      else if (norm.includes('farmacia') || norm.includes('farmácia')) name = 'Farmácia';
      else if (norm.includes('gasolina')) name = 'Gasolina';

      const selectedAccount = resolveMoneAccount(context, undefined, context.accounts?.find((account) =>
        account.isActive !== false && norm.includes(normalize(account.name))
      )?.name);
      if (selectedAccount.needsChoice) {
        return { text: 'Em qual conta você fez esse gasto? Diga, por exemplo, Galicia ou Naranja.', isInternalCalculation: true };
      }
      const cat = inferCategory(name, 'expense');
      const res = await handlers.onAddExpense({
        name,
        amount: parsedAmt,
        date: todayStr,
        category: cat,
        ...(selectedAccount.account ? { accountId: selectedAccount.account.id } : {}),
      });

      const createdId = res && typeof res === 'object' && res.id ? res.id : 'exp_' + Date.now();
      return {
        text: `Despesa de ${name} de ${formatCurrencySpoken(parsedAmt, selectedAccount.account?.currency || currency)} adicionada.`,
        isInternalCalculation: true,
        actionExecuted: 'add_expense',
        createdItem: { type: 'expense', id: createdId, name, amount: parsedAmt },
      };
    }
  }

  // 3. Income (e.g. "Recebi 50 mil de salário", "adicione receita de 1500")
  const isIncome =
    /\b(?:recebi|adicionei|adicione|adicionar|registre|registrar|lancei|lancar|caiu)\b/i.test(norm) &&
    (/\b(?:salario|receita|renda|freelance|freela|investimento)\b/i.test(norm) || /\brecebi\b/i.test(norm));

  if (isIncome && !requestsRecurrence && !hasExplicitDateOrMonth && !hasExplicitCurrency && handlers?.onAddIncome) {
    const parsedAmt = parseAmountFromText(question);
    if (parsedAmt && parsedAmt > 0) {
      let name = 'Receita';
      if (norm.includes('salario') || norm.includes('salário')) name = 'Salário';
      else if (norm.includes('freelance') || norm.includes('freela')) name = 'Freelance';
      else if (norm.includes('investimento')) name = 'Investimento';

      const selectedAccount = resolveMoneAccount(context, undefined, context.accounts?.find((account) =>
        account.isActive !== false && norm.includes(normalize(account.name))
      )?.name);
      if (selectedAccount.needsChoice) {
        return { text: 'Em qual conta você recebe essa receita? Diga o nome da conta.', isInternalCalculation: true };
      }
      const receivedNow = /\b(recebi|caiu)\b/.test(norm);
      const incomePayload = {
        name,
        amount: parsedAmt,
        expectedDay: 5,
        expectedDate: getEffectiveDateForMonth(currentMonthStr, 5),
        category: inferCategory(name, 'income'),
        recurrence: /\b(?:sem\s+repeticao|nao\s+repetir|uma\s+vez|avulso)\b/.test(norm)
          ? 'none' as const
          : /\b(?:recorrente|repetir|mensal|todo\s+mes|todos\s+os\s+meses)\b/.test(norm) || name === 'Salário'
            ? 'monthly' as const
            : 'none' as const,
        startMonth: currentMonthStr,
        ...(selectedAccount.account ? { accountId: selectedAccount.account.id } : {}),
      };
      const res = receivedNow && handlers.onAddIncomeAsReceived
        ? await handlers.onAddIncomeAsReceived(incomePayload, currentMonthStr)
        : await handlers.onAddIncome(incomePayload);

      const createdId = res && typeof res === 'object' && res.id ? res.id : 'inc_' + Date.now();
      if (receivedNow && !handlers.onAddIncomeAsReceived && handlers.onToggleIncomeReceived) {
        await handlers.onToggleIncomeReceived(createdId, currentMonthStr, true);
      }
      return {
        text: `Receita de ${name} de ${formatCurrencySpoken(parsedAmt, selectedAccount.account?.currency || currency)} adicionada.`,
        isInternalCalculation: true,
        actionExecuted: 'add_income',
        createdItem: { type: 'income', id: createdId, name, amount: parsedAmt },
      };
    }
  }

  // 4. Mark Bill Paid (e.g. "Paguei a academia", "marcar seguro como pago")
  const isMarkPaid =
    norm.includes('paguei') ||
    norm.includes('como pago') ||
    (norm.includes('marcar') && norm.includes('pago'));

  if (isMarkPaid && handlers?.onToggleBillPaid) {
    let matched = bills.find((b) => norm.includes(normalize(b.name)));
    if (!matched) {
      if (norm.includes('academia')) matched = bills.find((b) => normalize(b.name).includes('academia'));
      else if (norm.includes('seguro')) matched = bills.find((b) => normalize(b.name).includes('seguro'));
      else if (norm.includes('luz')) matched = bills.find((b) => normalize(b.name).includes('luz'));
      else if (norm.includes('internet')) matched = bills.find((b) => normalize(b.name).includes('internet'));
      else if (norm.includes('tenis') || norm.includes('tênis')) matched = bills.find((b) => normalize(b.name).includes('tênis') || normalize(b.name).includes('tenis'));
    }

    if (matched) {
      try {
        await handlers.onToggleBillPaid(matched.id, currentMonthStr, true);
        return {
          text: `Pronto. ${matched.name} marcada como paga.`,
          isInternalCalculation: true,
          actionExecuted: 'mark_paid',
        };
      } catch (err: any) {
        return {
          text: `Erro ao marcar a conta como paga no banco de dados: ${err?.message || 'Falha'}. Nenhuma alteração foi realizada.`,
          isInternalCalculation: true,
        };
      }
    }
  }

  // 4b. Update / Change Bill (e.g. "mudar o vencimento da compra da sapatilha para o dia 20", "alterar valor da sapatilha para 150")
  const isUpdateBillQuery =
    (norm.includes('mudar') || norm.includes('alterar') || norm.includes('trocar') || norm.includes('atualizar')) &&
    (norm.includes('vencimento') || norm.includes('data') || norm.includes('dia') || norm.includes('valor'));

  if (isUpdateBillQuery && handlers?.onUpdateBill) {
    const dayMatch =
      norm.match(/(?:para\s+o\s+dia|para\s+dia|pro\s+dia|dia)\s*(\d{1,2})/i) ||
      norm.match(/(?:vencimento|data)\s*(\d{1,2})/i) ||
      norm.match(/\b(\d{1,2})\b/);
    const parsedDay = dayMatch ? parseInt(dayMatch[1], 10) : null;
    const validDay = parsedDay && parsedDay >= 1 && parsedDay <= 31 ? parsedDay : null;
    const parsedAmt = parseAmountFromText(question);

    const billSearch = findMatchingBill(bills, undefined, undefined, question);
    if (billSearch.ambiguous && billSearch.ambiguous.length > 1) {
      const names = billSearch.ambiguous.map((b) => `"${b.name}"`).join(' ou ');
      return {
        text: `Encontrei mais de uma conta correspondente (${names}). Qual delas você deseja alterar?`,
        isInternalCalculation: true,
      };
    }

    const matchedBill = billSearch.match;
    if (matchedBill) {
      const partial: Partial<BillItem> = {};
      const updatesDesc: string[] = [];

      if (validDay && (norm.includes('vencimento') || norm.includes('data') || norm.includes('dia'))) {
        partial.dueDay = validDay;
        partial.dueDate = getEffectiveDateForMonth(currentMonthStr, validDay);
        updatesDesc.push(`vencimento para o dia ${validDay}`);
      }

      if (parsedAmt && parsedAmt > 0 && norm.includes('valor')) {
        partial.amount = parsedAmt;
        updatesDesc.push(`valor para ${formatCurrencySpoken(parsedAmt, currency)}`);
      }

      if (Object.keys(partial).length > 0) {
        try {
          await handlers.onUpdateBill(matchedBill.id, partial);
          return {
            text: `${matchedBill.name}: ${updatesDesc.join(' e ')} alterado com sucesso.`,
            isInternalCalculation: true,
            actionExecuted: 'update_bill',
            createdItem: {
              type: 'bill',
              id: matchedBill.id,
              name: matchedBill.name,
              amount: partial.amount ?? matchedBill.amount,
            },
          };
        } catch (err: any) {
          return {
            text: `Erro ao salvar a alteração da conta no banco de dados: ${err?.message || 'Falha de comunicação'}. A conta não foi alterada.`,
            isInternalCalculation: true,
          };
        }
      }
    }
  }

  // 4c. Delete Item (e.g. "apagar despesa de uber", "excluir compra da sapatilha", "excluir conta da internet")
  const isDeleteQuery =
    (norm.includes('apagar') || norm.includes('excluir') || norm.includes('deletar') || norm.includes('remover')) &&
    !norm.includes('como pago');

  if (isDeleteQuery) {
    const billSearch = findMatchingBill(bills, undefined, undefined, question);
    if (billSearch.match && handlers?.onDeleteBill) {
      try {
        await handlers.onDeleteBill(billSearch.match.id);
        return {
          text: `Conta "${billSearch.match.name}" excluída com sucesso.`,
          isInternalCalculation: true,
          actionExecuted: 'delete_item',
        };
      } catch (err: any) {
        return {
          text: `Erro ao excluir a conta no banco de dados: ${err?.message || 'Falha'}. Nenhuma alteração foi realizada.`,
          isInternalCalculation: true,
        };
      }
    }

    const expSearch = findMatchingExpense(expenses, undefined, undefined, lastActionItem, question);
    if (expSearch.match && handlers?.onDeleteExpense) {
      try {
        await handlers.onDeleteExpense(expSearch.match.id);
        return {
          text: `Despesa "${expSearch.match.name}" excluída com sucesso.`,
          isInternalCalculation: true,
          actionExecuted: 'delete_item',
        };
      } catch (err: any) {
        return {
          text: `Erro ao excluir a despesa no banco de dados: ${err?.message || 'Falha'}. Nenhuma alteração foi realizada.`,
          isInternalCalculation: true,
        };
      }
    }

    const incSearch = findMatchingIncome(incomes, undefined, undefined, lastActionItem, question);
    if (incSearch.match && handlers?.onDeleteIncome) {
      try {
        await handlers.onDeleteIncome(incSearch.match.id);
        return {
          text: `Receita "${incSearch.match.name}" excluída com sucesso.`,
          isInternalCalculation: true,
          actionExecuted: 'delete_item',
        };
      } catch (err: any) {
        return {
          text: `Erro ao excluir a receita no banco de dados: ${err?.message || 'Falha'}. Nenhuma alteração foi realizada.`,
          isInternalCalculation: true,
        };
      }
    }
  }

  // 5. Bill query (e.g. "Tenho algo para pagar em novembro?")
  if (norm.includes('pagar') || norm.includes('fatura') || norm.includes('contas')) {
    const targetMonth = extractTargetMonth(question, currentMonthStr);
    const data = calculateMonthFinancials(context, targetMonth);
    const monthName = formatMonthName(targetMonth, locale).split(' ')[0];

    if (data.monthBills.length === 0) {
      return {
        text: `Não. Você não tem contas para pagar em ${monthName}.`,
        isInternalCalculation: true,
      };
    }

    const totalsByCurrency = new Map<CurrencyCode, number>();
    for (const bill of data.monthBills) {
      totalsByCurrency.set(bill.currency, (totalsByCurrency.get(bill.currency) || 0) + bill.amount);
    }
    const totalSummary = [...totalsByCurrency.entries()]
      .map(([code, amount]) => formatCurrencySpoken(amount, code))
      .join(' + ');
    let text = `Sim. Você tem ${totalSummary} para pagar em ${monthName}:\n`;
    data.monthBills.forEach((bill) => {
      text += `• ${bill.name}: ${formatCurrencySpoken(bill.amount, bill.currency)}\n`;
    });

    return {
      text: text.trim(),
      isInternalCalculation: true,
    };
  }

  // 6. Income query (e.g. "Quanto vou receber em novembro?")
  if (norm.includes('receber') || norm.includes('receitas') || norm.includes('ingresso') || norm.includes('entradas')) {
    const targetMonth = extractTargetMonth(question, currentMonthStr);
    const data = calculateMonthFinancials(context, targetMonth);
    const totalsByCurrency = new Map<CurrencyCode, number>();
    for (const income of data.monthIncomes) {
      totalsByCurrency.set(income.currency, (totalsByCurrency.get(income.currency) || 0) + income.amount);
    }
    const summary = [...totalsByCurrency.entries()]
      .map(([code, amount]) => formatCurrencySpoken(amount, code))
      .join(' + ');
    return {
      text: `${summary || 'Nenhuma receita prevista'} em receitas previstas.`,
      isInternalCalculation: true,
    };
  }

  // Account-specific balance queries must be resolved before the consolidated balance.
  if (norm.includes('saldo') && context.accounts?.length) {
    const namedAccounts = context.accounts.filter((account) =>
      account.isActive !== false && normalize(question).includes(normalize(account.name))
    );
    if (namedAccounts.length === 1) {
      const account = namedAccounts[0];
      return {
        text: `A conta ${account.name} tem ${formatCurrencySpoken(Number(account.currentBalance ?? account.initialBalance ?? 0), account.currency)} disponíveis.`,
        isInternalCalculation: true,
      };
    }
  }

  // 7. Balance query (e.g. "Qual meu saldo atual?")
  if (norm.includes('saldo')) {
    const balanceSummary = formatCurrencyBreakdown(getCurrentBalancesByCurrency(context), 'não encontrei saldo nas contas ativas');
    return {
      text: `Seu saldo atual nas contas do SisFinz é ${balanceSummary}.`,
      isInternalCalculation: true,
    };
  }

  // =========================================================================
  // B. INTELLIGENT AI PROXY (/api/mone with fast 3.5s timeout)
  // =========================================================================
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), audio ? 18000 : 12000);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth.currentUser) {
      try {
        const token = await auth.currentUser.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
      } catch (tErr) {
        console.warn('Token fetch warning for /api/mone:', tErr);
      }
    }

    const apiRes = await fetch('/api/mone', {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        message: question || (audio ? 'Interprete o áudio enviado pelo usuário e execute a intenção.' : ''),
        ...(audio ? { audio: audio.data, audioMimeType: audio.mimeType } : {}),
        history: context.history || [],
        persona: context.persona || 'direto',
        context: {
          currentBalance,
          forecastBalance: context.forecastBalance ?? currentBalance,
          accounts: context.accounts || [],
          sharedBills: context.sharedBills || [],
          sharedPartners: context.sharedPartners || [],
          weeklyChallenges: context.weeklyChallenges || [],
          statusRecords: context.statusRecords || [],
          currency,
          language,
          bills,
          incomes,
          expenses,
          goals,
          savings: context.savings || [],
          savingTransactions: context.savingTransactions || [],
          categories: context.categories || [],
          lastActionItem,
        },
      }),
    });
    clearTimeout(timeoutId);

    if (apiRes.ok) {
      const parsed = await apiRes.json();
      const result = await executeMoneIntent(parsed, context);
      if (result) return result;
    }
  } catch (apiErr) {
    console.warn('Backend /api/mone unavailable or timed out, using client fallback:', apiErr);
  }

  // C. TRY CLIENT-SIDE GEMINI IF API KEY AVAILABLE
  const apiKey =
    process.env.GEMINI_API_KEY ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
    '';

  if (apiKey) {
    try {
      const accountSummary = (context.accounts || [])
        .filter((account) => account.isActive !== false)
        .map((account) => ({
          id: account.id,
          name: account.name,
          currency: account.currency,
          currentBalance: account.currentBalance ?? account.initialBalance ?? 0,
        }));
      const billsSummary = bills.map((bill) => ({
        id: bill.id, name: bill.name, amount: bill.amount, dueDay: bill.dueDay,
        accountId: bill.accountId,
        currency: context.accounts?.find((account) => account.id === bill.accountId)?.currency || currency,
        recurrence: bill.recurrence,
      }));
      const categoriesSummary = context.categories || [];
      const sharedPartnersSummary = context.sharedPartners || [];
      const sharedBillsSummary = (context.sharedBills || []).map((bill) => ({
        id: bill.id, title: bill.title, amount: bill.amount, dueDate: bill.dueDate,
        partnerId: bill.members.find((memberId) => memberId !== context.myUserId),
        myPercentage: bill.percentages?.[context.myUserId || ''],
        myShare: bill.shares?.[context.myUserId || '']?.amount,
        myShareStatus: bill.shares?.[context.myUserId || '']?.status,
      }));
      const savingsSummary = (context.savings || []).map((saving) => ({
        id: saving.id, name: saving.name, currentAmount: saving.currentAmount,
        targetAmount: saving.targetAmount, hasTarget: saving.hasTarget, currency: saving.currency || currency,
      }));
      const savingTransactionsSummary = (context.savingTransactions || []).slice(0, 30);
      const incomesSummary = incomes.map((income) => ({
        id: income.id, name: income.name, amount: income.amount,
        accountId: income.accountId,
        currency: context.accounts?.find((account) => account.id === income.accountId)?.currency || currency,
        recurrence: income.recurrence,
      }));

      const systemPrompt = `Você é Mone, a inteligência integrada ao aplicativo SisFinz. Seu nome é Mone; nunca diga Gemini nem o nome de qualquer modelo.
Você não é um chatbot financeiro limitado: conversa sobre qualquer assunto e, quando o pedido envolver o SisFinz, interpreta a intenção, consulta os dados reais abaixo e executa a operação correspondente usando os manipuladores disponíveis. Nunca invente saldos, valores, contas, moedas, registros ou resultados.
Data: ${todayStr}; mês atual: ${currentMonthStr}; moeda padrão: ${currency}; idioma: ${language}.
Use somente os saldos individuais por conta e moeda listados abaixo; nunca some moedas diferentes. Para previsões, calcule por moeda com os registros do mês solicitado.
Contas ativas: ${JSON.stringify(accountSummary)}
Categorias disponíveis: ${JSON.stringify(categoriesSummary)}
Pessoas conectadas: ${JSON.stringify(sharedPartnersSummary)}
Contas compartilhadas: ${JSON.stringify(sharedBillsSummary)}
Cofrinhos: ${JSON.stringify(savingsSummary)}
Movimentações dos cofrinhos: ${JSON.stringify(savingTransactionsSummary)}
Contas/faturas: ${JSON.stringify(billsSummary)}
Receitas: ${JSON.stringify(incomesSummary)}
Despesas: ${JSON.stringify(expenses.slice(-60).map((expense) => ({
        id: expense.id, name: expense.name, amount: expense.amount, date: expense.date,
        accountId: (expense as any).accountId,
        currency: context.accounts?.find((account) => account.id === (expense as any).accountId)?.currency || currency,
      })))} )
Último lançamento manipulado: ${lastActionItem ? JSON.stringify(lastActionItem) : 'nenhum'}.
Histórico: ${JSON.stringify(context.history || [])}

REGRAS:
- Para saldo atual, use contas ativas e separe os subtotais por moeda. Nunca some moedas diferentes.
- Para previsão de um mês, use o saldo atual das contas + receitas ainda pendentes - contas ainda pendentes daquele mês, consultando os registros e suas recorrências. Respeite as moedas individuais.
- Perguntas sobre contas a pagar devem retornar apenas obrigações pendentes/atrasadas do mês solicitado, incluindo a parte do usuário em contas compartilhadas.
- Perguntas sobre ingressos/receitas devem consultar os registros que ocorrem no mês solicitado.
- Transferência: intent "transfer_between_accounts", com fromAccountName, toAccountName e amount. Identifique as duas contas pelos nomes da lista; se faltar origem/destino/valor, use "ask_clarification". Não invente IDs.
- Gasto: intent "add_expense", com name, amount, accountName (se mencionado) e category. Se houver várias contas ativas e nenhuma for indicada, pergunte em qual conta foi o gasto.
- Receita: intent "add_income", com name, amount, accountName, expectedDay, targetMonth, isRecurring e isReceived. "Recebi/caiu" significa isReceived=true; "adicione/registre uma receita" sem dizer que recebeu significa isReceived=false.
- Fatura/conta: intent "add_bill", com name, amount, accountName, dueDay, targetMonth e isRecurring. Sem repetição: isRecurring=false. Repetição mensal: isRecurring=true. Se faltar valor ou vencimento essencial, pergunte antes.
- Compra parcelada: intent "add_installment_bill", com name, totalAmount, installmentsCount, dueDay, accountName e targetMonth.
- Uma despesa recorrente deve ser cadastrada como fatura recorrente, não como despesa avulsa.
- Contas: consulte com "query_accounts"; crie com "create_account"; edite com "update_account"; exclua com "delete_account"; ative/desative com "toggle_account_active". Use o ID/nome exato, moeda e saldo informados.
- Contas compartilhadas: consulte com "query_shared_bills"; crie com "create_shared_bill"; edite com "update_shared_bill"; exclua com "delete_shared_bill". Use uma conexão ativa, confirme parceiro, valor e vencimento. Se não informar divisão, reutilize a última divisão com a mesma pessoa; sem histórico, use 50/50. Se disser apenas 60/40 sem indicar qual parte é sua, pergunte.
- Categorias: consulte com "query_categories"; crie com "create_category"; edite com "update_category"; exclua com "delete_category". Use o nome/ID exato e o escopo bill, income, expense ou all.
- Cofrinhos: consulte com "query_savings"; histórico com "query_saving_transactions"; crie com "create_saving_goal"; edite com "update_saving_goal"; aporte com "deposit_to_saving"; resgate com "withdraw_from_saving"; exclusão com "delete_saving_goal". Use o nome/ID exato do cofrinho. Para USD/BRL/EUR, pergunte a cotação em ARS se não foi informada.
- Consultas: use "query_balance", "query_account_balance", "query_bills", "query_incomes", "query_forecast", "query_spending", "query_shared_bills", "query_goal_progress" ou "query_weekly_challenge" conforme a pergunta.
- Marcar fatura como paga: "mark_bill_paid". Marcar receita recebida: "mark_income_received".
- Para correções, edições e exclusões, identifique exatamente o registro. Se houver mais de um possível, pergunte qual. Nunca exclua por suposição.
- Para abrir uma tela solicitada explicitamente, use "navigate_to_section" e data.section com o nome exato da seção. Exemplos: contas=accounts, planejamento=planejar, calendário=financial_calendar, relatório=report, metas=goals, cofrinhos=savings, compartilhadas=shared_accounts.
- Para conversa geral, use "conversation" e responda naturalmente, sem transformar tudo em tarefa financeira.
Retorne somente JSON válido com a estrutura:
{
  "intent": "conversation" | "add_expense" | "add_income" | "add_installment_bill" | "add_bill" | "transfer_between_accounts" | "mark_bill_paid" | "mark_income_received" | "update_bill" | "update_income" | "update_expense" | "delete_item" | "query_balance" | "query_account_balance" | "query_bills" | "query_incomes" | "query_forecast" | "query_spending" | "query_shared_bills" | "query_goal_progress" | "query_weekly_challenge" | "query_savings" | "query_saving_transactions" | "create_saving_goal" | "update_saving_goal" | "deposit_to_saving" | "withdraw_from_saving" | "delete_saving_goal" | "query_accounts" | "create_account" | "update_account" | "delete_account" | "toggle_account_active" | "query_categories" | "create_category" | "update_category" | "delete_category" | "create_shared_bill" | "update_shared_bill" | "delete_shared_bill" | "navigate_to_section" | "ask_clarification",
  "data": {
    "name": string, "amount": number, "totalAmount": number, "installmentsCount": number,
    "fromAccountName": string, "toAccountName": string, "accountName": string, "accountId": string,
    "savingName": string, "savingId": string, "categoryName": string, "categoryId": string,
    "partnerName": string, "partnerId": string, "myPercentage": number, "partnerPercentage": number,
    "dueDate": string, "recurrenceMonthsCount": number, "newName": string, "scope": string,
    "type": string, "currency": string, "initialBalance": number,
    "currentBalance": number, "isActive": boolean, "hasTarget": boolean, "withoutTarget": boolean,
    "targetAmount": number, "exchangeRate": number, "date": string, "note": string, "notes": string,
    "dueDay": number, "expectedDay": number, "isRecurring": boolean, "isReceived": boolean,
    "targetMonth": "YYYY-MM", "category": string, "newAmount": number, "matchedId": string, "section": string
  },
  "directResponse": string
}`;

      const ai = new GoogleGenAI({ apiKey });
      const geminiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\nMensagem do usuário: "${question}"` }] },
        ],
        config: {
          responseMimeType: 'application/json',
          maxOutputTokens: 250,
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

      const rawJson = geminiResponse.text?.trim();
      if (rawJson) {
        const parsed = JSON.parse(rawJson);
        const result = await executeMoneIntent(parsed, context);
        if (result) return result;
      }
    } catch (aiErr) {
      console.warn('Client Gemini parse failed, proceeding to default fallback:', aiErr);
    }
  }

  return {
    text:
      language === 'pt'
        ? 'Entendido. Como posso ajudar com suas despesas, contas ou receitas agora?'
        : language === 'es'
        ? 'Entendido. ¿Cómo puedo ayudarte con tus gastos, facturas o ingresos ahora?'
        : 'Understood. How can I help with your expenses, bills or incomes right now?',
    isInternalCalculation: true,
  };
}

