export type CurrencyCode = 'BRL' | 'USD' | 'EUR' | 'ARS';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  name: string;
  locale: string;
  flag?: string;
  country?: string;
}

export interface ChallengeSquare {
  id: number;
  value: number;
  isAdjustment?: boolean; // true if it's the final adjustment square to match exact target
}

export interface DepositRecord {
  squareNumber: number; // square index/id (0 for avulso deposits)
  amount: number; // exact value deposited
  timestamp: string; // ISO string
  id: string;
  isAvulso?: boolean; // true if it was an ad-hoc / avulso deposit
  note?: string; // optional user note (e.g. "Bônus", "Renda extra")
}

export interface ChallengeGoal {
  id: string;
  userId?: string;
  title: string;
  icon: string;
  currency?: CurrencyCode; // Goal-specific currency
  targetAmount?: number; // Chosen target amount
  startAmount?: number; // Starting deposit amount / base step
  squaresMode?: 'equal' | 'progressive'; // Division mode: equal values or progressive tiers
  squaresCount?: number; // Number of squares chosen by user
  totalTarget: number; // Exact calculated target sum
  totalSquares: number; // Number of squares generated
  squares?: ChallengeSquare[]; // Dynamic list of squares
  completedSquares: number[]; // Array of completed square IDs
  history: DepositRecord[];
  createdAt: string;
  updatedAt: string;
  notes?: string;
  avulsoTotal?: number; // Total amount from ad-hoc deposits
  // Legacy compatibility fields:
  startNumber?: number;
  endNumber?: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  isUnlocked: (goal: ChallengeGoal) => boolean;
}

export type LanguageCode = 'pt' | 'es' | 'en';

export type MoneStyle = 'direto' | 'coach' | 'vovo' | 'sincerao';
export type MoneMood = 'happy' | 'calm' | 'worried' | 'scared' | 'sleeping';

export interface AppSettings {
  currency: CurrencyCode;
  darkMode: boolean;
  soundEnabled: boolean;
  language?: LanguageCode;
  moneStyle?: MoneStyle;
}

export interface AppData {
  goals: ChallengeGoal[];
  activeGoalId: string;
  settings: AppSettings;
  unlockedAchievements: string[];
}

// ==========================================
// Módulo de Controle Financeiro Mensal Types
// ==========================================

export type RecurrenceType = 'none' | 'monthly';

export type CategoryScope = 'all' | 'bill' | 'income' | 'expense';

export interface CustomCategory {
  id: string;
  userId: string;
  name: string;
  scope: CategoryScope;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountDistribution {
  accountId: string;
  amount: number;
}

export interface BillItem {
  id: string;
  userId: string;
  name: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  dueDay: number; // 1-31 (day of month)
  category: string;
  notes?: string;
  accountId?: string; // Optional linked account
  accountDistributions?: AccountDistribution[];
  recurrence: RecurrenceType;
  recurrenceMonthsCount?: number; // 0 for "Repetir para sempre", or custom positive int
  startMonth: string; // YYYY-MM
  createdAt: string;
  updatedAt: string;
  exceptions?: Record<string, Partial<BillItem> & { isDeleted?: boolean }>;
  excludedMonths?: string[];
  isSharedExemptFromTotal?: boolean;
  isRefund?: boolean;
  isRefunded?: boolean;
  refundedAt?: string;
  refundTransferId?: string;
}

export interface IncomeItem {
  id: string;
  userId: string;
  name: string;
  amount: number;
  expectedDate: string; // YYYY-MM-DD
  expectedDay: number; // 1-31
  category: string;
  notes?: string;
  accountId?: string; // Optional linked account
  accountDistributions?: AccountDistribution[];
  recurrence: RecurrenceType;
  recurrenceMonthsCount?: number; // 0 for "Repetir para sempre", or custom positive int
  startMonth: string; // YYYY-MM
  createdAt: string;
  updatedAt: string;
  exceptions?: Record<string, Partial<IncomeItem> & { isDeleted?: boolean }>;
  excludedMonths?: string[];
  isSharedGenerated?: boolean;
  isReimbursement?: boolean;
  sharedBillId?: string;
  originalTransferId?: string;
  originalTargetMonth?: string;
  fromUserId?: string;
  isRefund?: boolean;
  isRefunded?: boolean;
  refundedAt?: string;
  refundTransferId?: string;
}

export interface ExpenseItem {
  id: string;
  userId: string;
  name: string;
  amount: number;
  date: string; // YYYY-MM-DD
  category: string; // "Alimentação", "Compras", "Lazer", "Transporte", "Saúde", "Outros"
  notes?: string;
  accountId?: string; // Optional linked account
  accountDistributions?: AccountDistribution[];
  isSharedGenerated?: boolean;
  isRefund?: boolean;
  isRefunded?: boolean;
  refundedAt?: string;
  refundTransferId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyStatusRecord {
  id: string; // `${type}_${itemId}_${month}`
  userId: string;
  itemId: string;
  itemType: 'bill' | 'income';
  month: string; // YYYY-MM
  isCompleted: boolean; // paid for bill, received for income
  completedAt?: string;
}

export interface RitmoDiarioConfig {
  customPaydayDate?: string;
  customPaydayAmount?: number;
  safetyReserveAmount?: number;
  useAutoPayday?: boolean;
}

export interface FinanceSettings {
  userId: string;
  currentBalance: number;
  initialBalance?: number;
  monthlyInitialBalances?: Record<string, number>;
  ritmoDiarioConfig?: RitmoDiarioConfig;
  updatedAt: string;
}

export type BillStatus = 'pending' | 'paid' | 'overdue';
export type IncomeStatus = 'pending' | 'received';

export interface MonthBillOccurrence {
  bill: BillItem;
  month: string; // YYYY-MM
  effectiveDueDate: string; // YYYY-MM-DD
  status: BillStatus;
  paidAt?: string;
  installmentLabel?: string | null; // e.g. "Parcela 3/8"
}

export interface MonthIncomeOccurrence {
  income: IncomeItem;
  month: string; // YYYY-MM
  effectiveDate: string; // YYYY-MM-DD
  status: IncomeStatus;
  receivedAt?: string;
}

export type TimelineItemType = 'income' | 'bill' | 'expense';

export interface MonthTimelineItem {
  id: string;
  type: TimelineItemType;
  name: string;
  amount: number; // positive for income, negative visually for bill/expense
  date: string; // YYYY-MM-DD
  formattedDayMonth: string; // e.g. "05 OUT"
  category: string;
  notes?: string;
  status: 'to_receive' | 'received' | 'pending' | 'paid' | 'overdue';
  statusLabel: string;
  originalId: string;
  isRecurring: boolean;
  installmentLabel?: string | null; // e.g. "Parcela 3/8"
}

export interface SavingGoal {
  id: string;
  userId: string;
  name: string; // e.g. "Ahorro para moto"
  hasTarget?: boolean; // true = com objetivo (meta), false = sem objetivo (livre/avulso)
  targetAmount?: number; // Monto objetivo (opcional se hasTarget === false)
  currentAmount: number; // Monto ahorrado na moeda do cofrinho
  currency?: CurrencyCode; // 'ARS' | 'USD' | 'BRL'
  deadline?: string; // Fecha límite opcional (YYYY-MM-DD)
  icon?: string; // Emoji or icon identifier
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavingTransaction {
  id: string;
  userId: string;
  savingId: string;
  savingName: string;
  type: 'deposit' | 'withdrawal';
  amount: number; // quantidade na moeda do cofrinho
  currency?: CurrencyCode; // moeda do cofrinho ('ARS' | 'USD' | 'BRL')
  exchangeRate?: number; // cotação utilizada em relação ao ARS (1 para ARS)
  baseAmountARS?: number; // valor equivalente em pesos argentinos (amount * exchangeRate)
  date: string; // YYYY-MM-DD
  note?: string;
  createdAt: string;
  expenseId?: string;
  incomeId?: string;
}

// ==========================================
// Módulo de Contas Compartilhadas Types
// ==========================================

export interface UserDirectoryEntry {
  uid: string;
  email: string;
  displayName: string;
  updatedAt: string;
}

export interface SharedUserSummary {
  uid: string;
  displayName: string;
  email: string;
}

export type SharedInvitationStatus = 'pending' | 'accepted' | 'rejected';

export interface SharedInvitation {
  id: string;
  fromUserId: string;
  fromUserName: string;
  fromUserEmail: string;
  toUserId: string;
  toUserEmail: string;
  status: SharedInvitationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SharedConnection {
  id: string;
  members: string[]; // [uid1, uid2]
  memberProfiles: Record<string, SharedUserSummary>;
  status: 'active' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export type SplitMethod = 'fifty_fifty' | 'custom_percentage';

export interface SharedParticipantShare {
  amount: number;
  percentage: number;
  status: 'pending' | 'transferred' | 'paid';
  transferredTo?: string; // UID of partner
  transferredAt?: string;
}

export interface SharedBillReimbursement {
  fromUserId: string; // User who owes their share
  toUserId: string;   // User who paid 100% of the bill to creditor
  amount: number;
  status: 'pending' | 'settled';
  settledAt?: string;
  transferId?: string;
}

export interface SharedBillRequest {
  status: 'pending' | 'accepted' | 'rejected';
  requestedTo: string; // UID
  requestedBy: string; // UID
  createdAt: string;
}

export interface SharedBill {
  id: string;
  createdBy: string;
  members: string[]; // [uid1, uid2]
  title: string;
  amount: number; // Total amount of bill
  dueDate: string; // YYYY-MM-DD
  dueDay: number; // 1-31
  month: string; // YYYY-MM
  category: string;
  notes?: string;
  splitMethod: SplitMethod;
  percentages: Record<string, number>; // { [uid]: percentage }
  shares: Record<string, SharedParticipantShare>;
  status: 'pending' | 'paid'; // 'paid' when full bill is paid to creditor
  paymentResponsibility: string | null; // UID of user responsible for paying creditor
  paidBy?: string;
  paidAt?: string;
  paidAmount?: number;
  reimbursement?: SharedBillReimbursement;
  shareRequest?: SharedBillRequest;
  createdAt: string;
  updatedAt: string;
  recurrence?: 'none' | 'monthly';
  recurrenceMonthsCount?: number;
  startMonth: string;
  exceptions?: Record<string, Partial<SharedBill> & { isDeleted?: boolean; deletedForUsers?: string[] }>;
  excludedMonths?: string[];
  hiddenForUsers?: string[];
  accountId?: string;
  isRefund?: boolean;
  isRefunded?: boolean;
  refundedAt?: string;
  refundTransferId?: string;
}

export interface SharedTransferBreakdownItem {
  billId: string;
  title: string;
  amount: number;
}

export interface SharedTransferRecord {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
  billIds: string[];
  billBreakdown: SharedTransferBreakdownItem[];
  description: string;
  type: 'share_transfer' | 'reimbursement';
  status: 'completed';
  createdAt: string;
  hiddenForUsers?: string[];
}

export type SharedNotificationType =
  | 'invitation_received'
  | 'invitation_accepted'
  | 'invitation_rejected'
  | 'share_bill_request'
  | 'share_bill_accepted'
  | 'share_bill_rejected'
  | 'bill_created'
  | 'bill_updated'
  | 'transfer_sent'
  | 'transfer_received'
  | 'bill_paid'
  | 'reimbursement_created';

export interface SharedNotification {
  id: string;
  userId: string; // Recipient
  fromUserId: string;
  fromUserName: string;
  type: SharedNotificationType;
  title: string;
  message: string;
  data?: {
    invitationId?: string;
    billId?: string;
    transferId?: string;
    amount?: number;
    relatedBillsCount?: number;
    [key: string]: any;
  };
  isRead: boolean;
  status: 'pending' | 'resolved';
  createdAt: string;
}

// ==========================================
// Módulo Desafio de 52 Semanas Types
// ==========================================

export interface FiftyTwoWeekChallenge {
  id: string;
  userId: string;
  title: string;
  currency?: CurrencyCode; // Currency chosen for this weekly savings plan
  initialAmount: number; // e.g. 1000
  startDate: string; // YYYY-MM-DD
  totalTarget: number; // initialAmount * sum of week numbers
  totalWeeks?: number; // User-defined duration; legacy challenges default to 52
  savingMode?: 'progressive' | 'fixed'; // Legacy plans default to progressive
  storageLocation?: string; // Informational note: where the saved money is physically kept
  weekAccountIds?: Record<number, string>; // Account debited for each registered weekly deposit
  redeemedAt?: string; // When the completed savings plan was transferred into an account
  redemptionIncomeId?: string; // Normal income entry created for the redemption
  redemptionAccountId?: string; // Account that received the completed plan
  completedWeeks: number[]; // Array of week numbers, e.g. [1, 2, 3]
  weekExpenses?: Record<number, string>; // { [weekNumber]: expenseId }
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'completed';
}

// ==========================================
// Módulo de Contas e Saldos Types
// ==========================================

export type AccountType = 'bank' | 'wallet' | 'cash' | 'safe' | 'other';

export interface AccountItem {
  id: string;
  userId: string;
  name: string; // e.g. "Banco Galicia", "Santander", "Efectivo", "Mercado Pago"
  type: AccountType;
  currency: CurrencyCode;
  initialBalance: number;
  currentBalance: number;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountTransferRecord {
  id: string;
  userId: string;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  amount: number;
  date: string; // YYYY-MM-DD
  notes?: string;
  createdAt: string;
}

