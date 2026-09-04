import type { IncomeProject, PaymentRule, ProjectColor } from '@/types';

import { addDays, fromDateKey, toDateKey } from './dateHelpers';
import type { DebtPayment } from './debts';

const BIWEEKLY_INTERVAL_DAYS = 14;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function toSafeDate(dateInput: Date | string) {
  return typeof dateInput === 'string' ? fromDateKey(dateInput) : dateInput;
}

function isActiveProjectDate(project: IncomeProject, dateKey: string) {
  return !project.startDate || dateKey >= project.startDate;
}

function getMonthRange(dateInput: Date | string) {
  const targetDate = toSafeDate(dateInput);

  return {
    monthStart: new Date(targetDate.getFullYear(), targetDate.getMonth(), 1),
    monthEnd: new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0),
  };
}

function matchesOneTimeRule(rule: Extract<PaymentRule, { type: 'one_time' }>, dateKey: string) {
  return rule.paymentDate === dateKey;
}

function matchesMonthlyFixedDayRule(rule: Extract<PaymentRule, { type: 'monthly_fixed_day' }>, targetDate: Date) {
  return targetDate.getDate() === rule.paymentDayOfMonth;
}

function matchesWeeklyRule(rule: Extract<PaymentRule, { type: 'weekly' }>, targetDate: Date) {
  return targetDate.getDay() === rule.paymentWeekday;
}

function matchesBiweeklyRule(rule: Extract<PaymentRule, { type: 'biweekly' }>, targetDate: Date) {
  const startDate = fromDateKey(rule.paymentStartDate);
  const differenceInDays = Math.round((targetDate.getTime() - startDate.getTime()) / MILLISECONDS_PER_DAY);

  if (differenceInDays < 0 || differenceInDays % BIWEEKLY_INTERVAL_DAYS !== 0) {
    return false;
  }

  return rule.paymentWeekday === undefined || targetDate.getDay() === rule.paymentWeekday;
}

function matchesPaymentRule(rule: PaymentRule, targetDate: Date, dateKey: string) {
  switch (rule.type) {
    case 'one_time':
      return matchesOneTimeRule(rule, dateKey);
    case 'monthly_fixed_day':
      return matchesMonthlyFixedDayRule(rule, targetDate);
    case 'weekly':
      return matchesWeeklyRule(rule, targetDate);
    case 'biweekly':
      return matchesBiweeklyRule(rule, targetDate);
    default:
      return false;
  }
}

export function isPaydayForProject(project: IncomeProject, dateInput: Date | string) {
  const { paymentRule } = project;

  if (!paymentRule) {
    return false;
  }

  const targetDate = toSafeDate(dateInput);
  const dateKey = toDateKey(targetDate);

  if (!isActiveProjectDate(project, dateKey)) {
    return false;
  }

  return matchesPaymentRule(paymentRule, targetDate, dateKey);
}

export function getProjectPaydaysForMonth(project: IncomeProject, selectedMonth: Date | string) {
  const { monthStart, monthEnd } = getMonthRange(selectedMonth);
  const paydays: string[] = [];

  for (let currentDate = monthStart; currentDate <= monthEnd; currentDate = addDays(currentDate, 1)) {
    if (isPaydayForProject(project, currentDate)) {
      paydays.push(toDateKey(currentDate));
    }
  }

  return paydays;
}

export type PaymentIndicator = {
  projectId: string;
  kind: 'income' | 'debt';
  color?: ProjectColor | null;
};

export function getPaymentIndicatorsForMonth(projects: IncomeProject[], debtPayments: DebtPayment[], selectedMonth: Date | string) {
  const indicators: Partial<Record<string, PaymentIndicator[]>> = {};

  projects.forEach((project) => {
    getProjectPaydaysForMonth(project, selectedMonth).forEach((dateKey) => {
      indicators[dateKey] = [...(indicators[dateKey] ?? []), { projectId: project.id, kind: 'income', color: project.color }];
    });
  });

  debtPayments.forEach((payment) => {
    indicators[payment.date] = [
      ...(indicators[payment.date] ?? []),
      { projectId: payment.projectId, kind: 'debt', color: payment.color },
    ];
  });

  return indicators;
}
