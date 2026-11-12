/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import { auth } from '../firebase/config';
import {
  BillItem,
  AccountItem,
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
} from '../types';
import {
  getCurrentMonthStr,
  getTodayStr,
  shiftMonthStr,
  formatMonthName,
  doesItemOccurInMonth,
  getEffectiveDateForMonth,
  getMonthDiff,
} from './finance';
import { formatCurrency } from './currency';
import { getLocaleForLanguage } from './i18n';

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
}

export interface MoneContext {
  currentBalance: number;
  forecastBalance?: number;
  accounts?: AccountItem[];
  sharedBills?: SharedBill[];
  weeklyChallenges?: FiftyTwoWeekChallenge[];
  myUserId?: string;
  bills: BillItem[];
  incomes: IncomeItem[];
  expenses: ExpenseItem[];
  statusRecords: MonthlyStatusRecord[];
  goals: ChallengeGoal[];
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

/**
 * Calculates financial figures for a given month
 */
export function calculateMonthFinancials(context: MoneContext, targetMonthStr: string) {
  const { currentBalance, bills, incomes, expenses, statusRecords } = context;
  const currentMonthStr = getCurrentMonthStr();

  const statusMap = new Map<string, MonthlyStatusRecord>();
  for (const rec of statusRecords) {
    statusMap.set(rec.id, rec);
  }

  interface OccItem {
    id: string;
    name: string;
    amount: number;
    category: string;
    date: string;
    isCompleted: boolean;
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

      monthIncomes.push({
        id: inc.id,
        name: inc.name,
        amount: effAmount,
        category: inc.category,
        date: effDate,
        isCompleted,
      });
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
      const isCompleted = statusMap.get(`bill_${bill.id}_${targetMonthStr}`)?.isCompleted === true;

      monthBills.push({
        id: bill.id,
        name: bill.name,
        amount: effAmount,
        category: bill.category,
        date: effDate,
        isCompleted,
      });
    }
  }

  const monthExpenses = expenses.filter((e) => e.date && e.date.startsWith(targetMonthStr));

  const totalIncomes = monthIncomes.reduce((acc, i) => acc + i.amount, 0);
  const totalBills = monthBills.reduce((acc, b) => acc + b.amount, 0);
  const totalOneOffExpenses = monthExpenses.reduce((acc, e) => acc + e.amount, 0);

  const receivedIncomes = monthIncomes.filter((i) => i.isCompleted).reduce((acc, i) => acc + i.amount, 0);
  const pendingIncomes = totalIncomes - receivedIncomes;

  const paidBills = monthBills.filter((b) => b.isCompleted).reduce((acc, b) => acc + b.amount, 0);
  const pendingBills = totalBills - paidBills;

  const monthlySurplus = totalIncomes - totalBills - totalOneOffExpenses;

  let projectedBalance: number;
  if (targetMonthStr === currentMonthStr) {
    projectedBalance = currentBalance + pendingIncomes - pendingBills;
  } else {
    const diff = getMonthDiff(currentMonthStr, targetMonthStr);
    if (diff > 0) {
      let running = currentBalance + pendingIncomes - pendingBills;
      for (let i = 1; i <= diff; i++) {
        const m = shiftMonthStr(currentMonthStr, i);
        let mInc = 0;
        let mBill = 0;

        for (const inc of incomes) {
          if (doesItemOccurInMonth(inc.startMonth, m, inc.recurrence, inc.recurrenceMonthsCount)) {
            const exc = inc.exceptions?.[m];
            if (exc?.isDeleted || inc.excludedMonths?.includes(m)) continue;
            mInc += exc?.amount ?? inc.amount;
          }
        }

        for (const bill of bills) {
          if (doesItemOccurInMonth(bill.startMonth, m, bill.recurrence, bill.recurrenceMonthsCount)) {
            const exc = bill.exceptions?.[m];
            if (exc?.isDeleted || bill.excludedMonths?.includes(m)) continue;
            mBill += exc?.amount ?? bill.amount;
          }
        }

        running += mInc - mBill;
      }
      projectedBalance = running;
    } else {
      projectedBalance = currentBalance + monthlySurplus;
    }
  }

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
    monthlySurplus,
    projectedBalance,
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
      if (lastActionItem.type === 'expense' && handlers?.onUpdateExpense) {
        await handlers.onUpdateExpense(lastActionItem.id, { amount: newAmount });
      } else if (lastActionItem.type === 'bill' && handlers?.onUpdateBill) {
        await handlers.onUpdateBill(lastActionItem.id, { amount: newAmount });
      } else if (lastActionItem.type === 'income' && handlers?.onUpdateIncome) {
        await handlers.onUpdateIncome(lastActionItem.id, { amount: newAmount });
      }

      const formatted = formatCurrency(newAmount, currency);
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
      text: `Você gastou ${formatCurrency(totalCat, currency)} com ${targetCat} em ${monthName}.`,
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
      if (challenge.completedWeeks.includes(weekNumber)) {
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
          text: parsed.directResponse || `Semana ${weekNumber} do desafio "${challenge.title}" concluída. ${formatCurrency(amount, challenge.currency || currency)} foi separado de ${accountMatches[0].name}.`,
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
      if (!Number.isInteger(weekNumber) || !challenge.completedWeeks.includes(weekNumber)) {
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
          text: parsed.directResponse || `Pronto. Marquei sua parte de "${target.title}" como paga${typeof share === 'number' ? ` (${formatCurrency(share, currency)})` : ''}.`,
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
          text: parsed.directResponse || `Transferi ${formatCurrency(amount, fromAccount.currency)} de ${fromAccount.name} para ${toAccount.name}.`,
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
    if (intent === 'add_expense' && d.amount && handlers?.onAddExpense) {
      try {
        const expName = d.name || 'Despesa';
        const cat = d.category || inferCategory(expName, 'expense');
        const res = await handlers.onAddExpense({
          name: expName,
          amount: d.amount,
          date: d.date || todayStr,
          category: cat,
        });
        const createdId = res && typeof res === 'object' && res.id ? res.id : 'exp_' + Date.now();
        return {
          text: parsed.directResponse || `Despesa de ${expName} de ${formatCurrency(d.amount, currency)} adicionada.`,
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
    if (intent === 'add_installment_bill' && (d.amount || d.totalAmount) && handlers?.onAddBill) {
      try {
        const installments = d.installmentsCount || 1;
        const instAmount = d.amount || (d.totalAmount ? Math.round((d.totalAmount / installments) * 100) / 100 : 0);
        const dueDay = d.dueDay || new Date().getDate();
        const startMonth = d.targetMonth || currentMonthStr;
        const dueDate = getEffectiveDateForMonth(startMonth, dueDay);
        const billName = d.name || 'Compra parcelada';

        const res = await handlers.onAddBill({
          name: billName,
          amount: instAmount,
          dueDay,
          dueDate,
          category: d.category || inferCategory(billName, 'bill'),
          recurrence: 'monthly',
          recurrenceMonthsCount: installments,
          startMonth,
        });

        const createdId = res && typeof res === 'object' && res.id ? res.id : 'bill_' + Date.now();
        return {
          text:
            parsed.directResponse ||
            `Pronto. ${billName} criada em ${installments} parcelas de ${formatCurrency(instAmount, currency)}, todo dia ${dueDay}.`,
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
        const isRecur = d.isRecurring !== false;
        const res = await handlers.onAddBill({
          name: billName,
          amount: d.amount,
          dueDay,
          dueDate: getEffectiveDateForMonth(currentMonthStr, dueDay),
          category: d.category || inferCategory(billName, 'bill'),
          recurrence: isRecur ? 'monthly' : 'none',
          startMonth: currentMonthStr,
        });
        const createdId = res && typeof res === 'object' && res.id ? res.id : 'bill_' + Date.now();
        return {
          text:
            parsed.directResponse ||
            `Pronto. Conta ${billName} de ${formatCurrency(d.amount, currency)} criada para todo dia ${dueDay}.`,
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
    if (intent === 'add_income' && d.amount && handlers?.onAddIncome) {
      try {
        const incName = d.name || 'Receita';
        const expDay = d.expectedDay || 5;
        const isRecur = d.isRecurring === true || incName.toLowerCase().includes('salario') || incName.toLowerCase().includes('salário');
        const res = await handlers.onAddIncome({
          name: incName,
          amount: d.amount,
          expectedDay: expDay,
          expectedDate: getEffectiveDateForMonth(currentMonthStr, expDay),
          category: d.category || inferCategory(incName, 'income'),
          recurrence: isRecur ? 'monthly' : 'none',
          startMonth: currentMonthStr,
        });
        const createdId = res && typeof res === 'object' && res.id ? res.id : 'inc_' + Date.now();
        return {
          text: parsed.directResponse || `Receita de ${incName} de ${formatCurrency(d.amount, currency)} adicionada.`,
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
        updatesDesc.push(`valor para ${formatCurrency(amt, currency)}`);
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
          text: parsed.directResponse || `Despesa de ${partial.name || targetExpense.name} alterada para ${formatCurrency(partial.amount ?? targetExpense.amount, currency)}.`,
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
          text: parsed.directResponse || `Receita de ${partial.name || targetIncome.name} alterada para ${formatCurrency(partial.amount ?? targetIncome.amount, currency)}.`,
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
            text: parsed.directResponse || `Pronto. ${matched.name} marcada como paga.`,
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
          text: parsed.directResponse || `Pronto. ${incomeSearch.match.name} marcada como recebida.`,
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
            text: parsed.directResponse || `Corrigido. Valor alterado para ${formatCurrency(d.newAmount, currency)}.`,
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
          text: parsed.directResponse || `Meta de economia '${gTitle}' de ${formatCurrency(d.targetAmount, currency)} criada.`,
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

      if (data.monthBills.length === 0) {
        return {
          text: `Não. Você não tem contas para pagar em ${monthName}.`,
          isInternalCalculation: true,
        };
      }

      let text = `Sim. Você tem ${formatCurrency(data.totalBills, currency)} para pagar em ${monthName}:\n`;
      data.monthBills.forEach((b) => {
        text += `• ${b.name}: ${formatCurrency(b.amount, currency)}\n`;
      });
      return {
        text: text.trim(),
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
      if (typeof d.notes === 'string') partial.notes = d.notes;
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
      return {
        text: `Em ${monthName}, você tem ${formatCurrency(data.totalOneOffExpenses, currency)} em despesas registradas e ${formatCurrency(data.totalBills, currency)} em contas previstas.`,
        isInternalCalculation: true,
      };
    }

    // 11. QUERY FORECAST
    if (intent === 'query_forecast') {
      const targetMonth = d.targetMonth || extractTargetMonth(question, currentMonthStr);
      const data = calculateMonthFinancials(ctx, targetMonth);
      const monthName = formatMonthName(targetMonth, locale).split(' ')[0];
      const projected = targetMonth === currentMonthStr && typeof ctx.forecastBalance === 'number'
        ? ctx.forecastBalance
        : data.projectedBalance;
      return {
        text: `A previsão de saldo para ${monthName} é ${formatCurrency(projected, currency)}.`,
        isInternalCalculation: true,
      };
    }

    // 10. QUERY INCOMES
    if (intent === 'query_incomes') {
      const targetMonth = d.targetMonth || extractTargetMonth(question, currentMonthStr);
      const data = calculateMonthFinancials(ctx, targetMonth);
      return {
        text: `${formatCurrency(data.totalIncomes, currency)} em receitas previstas.`,
        isInternalCalculation: true,
      };
    }

    // 11. QUERY BALANCE
    if (intent === 'query_balance') {
      return {
        text: `Seu saldo atual é de ${formatCurrency(currentBalance, currency)}.`,
        isInternalCalculation: true,
      };
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
        text: `A conta ${account.name} tem ${formatCurrency(account.currentBalance || 0, account.currency)} disponíveis.`,
        isInternalCalculation: true,
      };
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
        return inMonth && nameMatches && (!ctx.myUserId || bill.members.includes(ctx.myUserId));
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
        return `• ${effectiveTitle}: sua parte ${formatCurrency(share?.amount || 0, currency)} de ${formatCurrency(effectiveAmount, currency)} — ${share?.status === 'paid' ? 'paga' : 'pendente'}`;
      });
      return {
        text: `Suas contas compartilhadas em ${targetMonth}:\n${lines.join('\n')}`,
        isInternalCalculation: true,
      };
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
        return `• ${goal.title}: ${formatCurrency(saved, goal.currency || currency)} guardados de ${formatCurrency(target, goal.currency || currency)}; faltam ${formatCurrency(remaining, goal.currency || currency)}.`;
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
        text: `O desafio "${challenge.title}" está em ${completed.length} de ${totalWeeks} semanas. Você já separou ${formatCurrency(saved, challenge.currency || currency)} e faltam ${totalWeeks - completed.length} semanas.`,
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

    const res = await handlers.onAddBill({
      name,
      amount: instAmount,
      dueDay,
      dueDate: getEffectiveDateForMonth(targetMonth, dueDay),
      category: 'Compras',
      recurrence: 'monthly',
      recurrenceMonthsCount: installments,
      startMonth: targetMonth,
    });

    const createdId = res && typeof res === 'object' && res.id ? res.id : 'bill_' + Date.now();
    return {
      text: `Pronto. ${name} criada em ${installments} parcelas de ${formatCurrency(instAmount, currency)}, todo dia ${dueDay}.`,
      isInternalCalculation: true,
      actionExecuted: 'add_installment',
      createdItem: { type: 'bill', id: createdId, name, amount: instAmount },
    };
  }

  // 2. One-off Expense (e.g. "Gastei 2500 pesos de Uber agora", "adicione despesa de 4000 de uber hoje")
  const isExpense =
    /\b(?:gastei|comprei|adicionei|adicione|adicionar|registre|registrar|lancei|lancar|anotei|anotar)\b/i.test(norm);

  if (isExpense && handlers?.onAddExpense) {
    const parsedAmt = parseAmountFromText(question);
    if (parsedAmt && parsedAmt > 0) {
      let name = 'Despesa';
      if (norm.includes('uber')) name = 'Uber';
      else if (norm.includes('mercado') || norm.includes('supermercado')) name = 'Mercado';
      else if (norm.includes('almoco') || norm.includes('almoço')) name = 'Almoço';
      else if (norm.includes('jantar')) name = 'Jantar';
      else if (norm.includes('farmacia') || norm.includes('farmácia')) name = 'Farmácia';
      else if (norm.includes('gasolina')) name = 'Gasolina';

      const cat = inferCategory(name, 'expense');
      const res = await handlers.onAddExpense({
        name,
        amount: parsedAmt,
        date: todayStr,
        category: cat,
      });

      const createdId = res && typeof res === 'object' && res.id ? res.id : 'exp_' + Date.now();
      return {
        text: `Despesa de ${name} de ${formatCurrency(parsedAmt, currency)} adicionada.`,
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

  if (isIncome && handlers?.onAddIncome) {
    const parsedAmt = parseAmountFromText(question);
    if (parsedAmt && parsedAmt > 0) {
      let name = 'Receita';
      if (norm.includes('salario') || norm.includes('salário')) name = 'Salário';
      else if (norm.includes('freelance') || norm.includes('freela')) name = 'Freelance';
      else if (norm.includes('investimento')) name = 'Investimento';

      const res = await handlers.onAddIncome({
        name,
        amount: parsedAmt,
        expectedDay: 5,
        expectedDate: getEffectiveDateForMonth(currentMonthStr, 5),
        category: inferCategory(name, 'income'),
        recurrence: name === 'Salário' ? 'monthly' : 'none',
        startMonth: currentMonthStr,
      });

      const createdId = res && typeof res === 'object' && res.id ? res.id : 'inc_' + Date.now();
      return {
        text: `Receita de ${name} de ${formatCurrency(parsedAmt, currency)} adicionada.`,
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
        updatesDesc.push(`valor para ${formatCurrency(parsedAmt, currency)}`);
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

    let text = `Sim. Você tem ${formatCurrency(data.totalBills, currency)} para pagar em ${monthName}:\n`;
    data.monthBills.forEach((b) => {
      text += `• ${b.name}: ${formatCurrency(b.amount, currency)}\n`;
    });

    return {
      text: text.trim(),
      isInternalCalculation: true,
    };
  }

  // 6. Income query (e.g. "Quanto vou receber em novembro?")
  if (norm.includes('receber') || norm.includes('receitas')) {
    const targetMonth = extractTargetMonth(question, currentMonthStr);
    const data = calculateMonthFinancials(context, targetMonth);
    return {
      text: `${formatCurrency(data.totalIncomes, currency)} em receitas previstas.`,
      isInternalCalculation: true,
    };
  }

  // 7. Balance query (e.g. "Qual meu saldo atual?")
  if (norm.includes('saldo')) {
    return {
      text: `Seu saldo atual é de ${formatCurrency(currentBalance, currency)}.`,
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
          weeklyChallenges: context.weeklyChallenges || [],
          statusRecords: context.statusRecords || [],
          currency,
          language,
          bills,
          incomes,
          expenses,
          goals,
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
      const unpaidBills = bills.map((b) => ({ name: b.name, amount: b.amount, dueDay: b.dueDay }));
      const knownIncomes = incomes.map((i) => ({ name: i.name, amount: i.amount }));

      const systemPrompt = `Você é o Mone, o cérebro financeiro do aplicativo Mone.
Analise a mensagem do usuário e determine com alta precisão a intenção financeira.
Contexto:
- Data: ${todayStr} (Mês: ${currentMonthStr})
- Moeda: ${currency}
- Idioma: ${language}
- Último registro: ${lastActionItem ? JSON.stringify(lastActionItem) : 'nenhum'}
- Contas: ${JSON.stringify(unpaidBills)}
- Receitas: ${JSON.stringify(knownIncomes)}

Responda ESTRITAMENTE em formato JSON:
{
  "intent": "add_expense" | "add_income" | "add_installment_bill" | "add_bill" | "mark_bill_paid" | "correct_last_item" | "delete_item" | "query_bills" | "query_incomes" | "query_balance" | "query_category_spending" | "ask_clarification" | "general_query",
  "data": {
    "name": string,
    "amount": number,
    "totalAmount": number,
    "installmentsCount": number,
    "dueDay": number,
    "expectedDay": number,
    "isRecurring": boolean,
    "targetMonth": string,
    "category": string,
    "newAmount": number
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

