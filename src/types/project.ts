import type { CurrencyCode } from './app';

export type ProjectKind = 'income' | 'debt';
export type ContractType = 'hourly' | 'temporary' | 'part-time' | 'full-time' | 'freelance';
export type WeekdayEstimationKey = 'monHours' | 'tueHours' | 'wedHours' | 'thuHours' | 'friHours' | 'satHours' | 'sunHours';

export type WeeklyEstimation = Record<WeekdayEstimationKey, number>;
export const PROJECT_COLOR_OPTIONS = ['#EF4444', '#F97316', '#10B981', '#14B8A6', '#0EA5E9', '#6366F1', '#8B5CF6', '#EC4899'] as const;
export type ProjectColor = (typeof PROJECT_COLOR_OPTIONS)[number];
export type PaymentType = 'one_time' | 'monthly_fixed_day' | 'weekly' | 'biweekly';
export type PaymentWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type DebtType = 'financing' | 'personal_loan' | 'bank_loan' | 'credit' | 'mortgage' | 'installment_purchase' | 'other';
export type CreditorType = 'company' | 'person';
export type PaymentFrequency = 'weekly' | 'biweekly' | 'monthly' | 'custom';
export type DebtStatus = 'active' | 'completed' | 'paused';

export type OneTimePaymentRule = {
  type: 'one_time';
  paymentDate: string;
};

export type MonthlyFixedDayPaymentRule = {
  type: 'monthly_fixed_day';
  paymentDayOfMonth: number;
};

export type WeeklyPaymentRule = {
  type: 'weekly';
  paymentWeekday: PaymentWeekday;
};

export type BiweeklyPaymentRule = {
  type: 'biweekly';
  paymentStartDate: string;
  paymentWeekday?: PaymentWeekday;
};

export type PaymentRule = OneTimePaymentRule | MonthlyFixedDayPaymentRule | WeeklyPaymentRule | BiweeklyPaymentRule;

export type ContractFile = {
  uri: string;
  name: string;
  mimeType: string;
};

type BaseProject = {
  id: string;
  name: string;
  projectKind: ProjectKind;
  currency: CurrencyCode;
  startDate: string;
  color?: ProjectColor | null;
};

export type IncomeProject = BaseProject & {
  projectKind: 'income';
  hourlyRate: number;
  contractType: ContractType;
  paymentRule?: PaymentRule;
  weeklyEstimation?: WeeklyEstimation;
  contractFile?: ContractFile;
};

export type DebtProject = BaseProject & {
  projectKind: 'debt';
  debtType: DebtType;
  creditorType: CreditorType;
  creditorName: string;
  principalAmount: number;
  paymentStartDate: string;
  endDate: string;
  installmentCount?: number;
  paymentFrequency: PaymentFrequency;
  manualPayment: boolean;
  installmentAmount?: number;
  interestRate?: number;
  finalAmount: number;
  notes?: string;
  status: DebtStatus;
};

export type Project = IncomeProject | DebtProject;
export type CreateIncomeProjectInput = Omit<IncomeProject, 'id'>;
export type CreateDebtProjectInput = Omit<DebtProject, 'id'>;
export type CreateProjectInput = CreateIncomeProjectInput | CreateDebtProjectInput;
export type UpdateProjectInput = CreateProjectInput;

export function isIncomeProject(project: Project): project is IncomeProject {
  return project.projectKind === 'income';
}

export function isDebtProject(project: Project): project is DebtProject {
  return project.projectKind === 'debt';
}
