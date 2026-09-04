import type { CurrencyCode, ExpenseProject } from '@/types';

import { addDays, fromDateKey, toDateKey } from './dateHelpers';
import type { CurrencyTotals } from './earnings';

export type ExpenseOccurrence = {
  projectId: string;
  projectName: string;
  providerName: string;
  currency: CurrencyCode;
  date: string;
  amount: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const toCents = (amount: number) => Math.round(amount * 100);
const fromCents = (amount: number) => amount / 100;

function dayNumber(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

function addMonthsFromAnchor(anchor: Date, months: number) {
  const target = new Date(anchor.getFullYear(), anchor.getMonth() + months, 1);
  target.setDate(Math.min(anchor.getDate(), new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()));
  return target;
}

function getExpenseDatesForMonth(project: ExpenseProject, selectedMonth: Date) {
  const monthStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
  const monthEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);
  const monthStartKey = toDateKey(monthStart);
  const monthEndKey = toDateKey(monthEnd);

  if (
    project.status !== 'active' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(project.startDate) ||
    !Number.isFinite(project.amount) ||
    project.amount <= 0 ||
    project.startDate > monthEndKey ||
    (project.endDate && project.endDate < monthStartKey)
  ) {
    return [];
  }

  if (project.recurrenceType === 'one_time') {
    return project.startDate >= monthStartKey && project.startDate <= monthEndKey ? [project.startDate] : [];
  }

  const startDate = fromDateKey(project.startDate);

  if (project.recurrenceType === 'monthly' || project.recurrenceType === 'yearly') {
    const monthDifference = (monthStart.getFullYear() - startDate.getFullYear()) * 12 + monthStart.getMonth() - startDate.getMonth();
    const intervalMonths = project.recurrenceType === 'yearly' ? 12 : 1;

    if (monthDifference < 0 || monthDifference % intervalMonths !== 0) {
      return [];
    }

    const dateKey = toDateKey(addMonthsFromAnchor(startDate, monthDifference));
    return !project.endDate || dateKey <= project.endDate ? [dateKey] : [];
  }

  const intervalDays = project.recurrenceType === 'weekly' ? 7 : project.recurrenceType === 'biweekly' ? 14 : project.validityDays;

  if (!intervalDays || intervalDays <= 0) {
    return [];
  }

  const firstIndex = Math.max(0, Math.ceil((dayNumber(monthStart) - dayNumber(startDate)) / intervalDays));
  const dates: string[] = [];

  for (let index = firstIndex; ; index += 1) {
    const dateKey = toDateKey(addDays(startDate, index * intervalDays));

    if (dateKey > monthEndKey || (project.endDate && dateKey > project.endDate)) {
      break;
    }

    if (dateKey >= monthStartKey) {
      dates.push(dateKey);
    }
  }

  return dates;
}

export function getExpenseOccurrencesForMonth(projects: ExpenseProject[], selectedMonth: Date): ExpenseOccurrence[] {
  return projects.flatMap((project) =>
    getExpenseDatesForMonth(project, selectedMonth).map((date) => ({
      projectId: project.id,
      projectName: project.name,
      providerName: project.providerName,
      currency: project.currency,
      date,
      amount: fromCents(toCents(project.amount)),
    })),
  );
}

export function getExpenseTotalsByCurrency(occurrences: ExpenseOccurrence[]) {
  return occurrences.reduce<CurrencyTotals>((totals, occurrence) => {
    totals[occurrence.currency] = fromCents(toCents(totals[occurrence.currency] ?? 0) + toCents(occurrence.amount));
    return totals;
  }, {});
}
