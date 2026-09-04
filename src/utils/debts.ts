import type { CurrencyCode, DebtProject, PaymentFrequency } from '@/types';

import { addDays, fromDateKey, toDateKey } from './dateHelpers';
import type { CurrencyTotals } from './earnings';

export type DebtPayment = {
  projectId: string;
  projectName: string;
  creditorName: string;
  currency: CurrencyCode;
  color: DebtProject['color'];
  date: string;
  amount: number;
  installmentNumber: number;
  installmentCount?: number;
  manualPayment: boolean;
};

export type MonthlyCashFlow = {
  incomesByCurrency: CurrencyTotals;
  debtsByCurrency: CurrencyTotals;
  expensesByCurrency: CurrencyTotals;
  outgoingsByCurrency: CurrencyTotals;
  netByCurrency: CurrencyTotals;
};

const toCents = (amount: number) => Math.round(amount * 100);
const fromCents = (amount: number) => amount / 100;

function addMonthsFromAnchor(anchor: Date, months: number) {
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth() + months, 1);
  const lastDay = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  monthStart.setDate(Math.min(anchor.getDate(), lastDay));
  return monthStart;
}

export function deriveDebtPlan(
  principalAmount: number,
  interestRate: number | undefined,
  installmentCount: number | undefined,
  paymentFrequency: PaymentFrequency,
  paymentStartDate: string,
) {
  const principalCents = Number.isFinite(principalAmount) ? toCents(principalAmount) : Number.NaN;
  const interest = Number.isFinite(interestRate) && (interestRate ?? 0) >= 0 ? (interestRate ?? 0) : 0;
  const finalAmountCents = Math.round((principalCents * (100 + interest)) / 100);
  const hasInstallments = Number.isInteger(installmentCount) && (installmentCount ?? 0) > 0;
  const lastInstallmentIndex = hasInstallments ? installmentCount! - 1 : 0;
  const paymentDate = fromDateKey(paymentStartDate);
  const endDate =
    paymentFrequency === 'monthly'
      ? addMonthsFromAnchor(paymentDate, lastInstallmentIndex)
      : paymentFrequency === 'weekly' || paymentFrequency === 'biweekly'
        ? addDays(paymentDate, lastInstallmentIndex * (paymentFrequency === 'weekly' ? 7 : 14))
        : paymentDate;

  return {
    finalAmount: fromCents(finalAmountCents),
    installmentAmount: hasInstallments ? fromCents(Math.round(finalAmountCents / installmentCount!)) : undefined,
    endDate: toDateKey(endDate),
  };
}

function getDebtPaymentDates(project: DebtProject) {
  if (
    !project.startDate ||
    !project.paymentStartDate ||
    !project.endDate ||
    project.paymentStartDate < project.startDate ||
    project.endDate < project.paymentStartDate
  ) {
    return [];
  }

  if (project.installmentCount === 1) {
    return [project.endDate];
  }

  if (project.paymentFrequency === 'custom') {
    return [];
  }

  const startDate = fromDateKey(project.paymentStartDate);
  const dates: string[] = [];
  const maxPayments = project.installmentCount ?? Number.POSITIVE_INFINITY;

  for (let index = 0; index < maxPayments; index += 1) {
    const paymentDate =
      project.paymentFrequency === 'monthly'
        ? addMonthsFromAnchor(startDate, index)
        : addDays(startDate, index * (project.paymentFrequency === 'weekly' ? 7 : 14));
    const dateKey = toDateKey(paymentDate);

    if (dateKey > project.endDate) {
      break;
    }

    dates.push(dateKey);
  }

  return dates;
}

function resolveInstallmentCents(project: DebtProject, paymentCount: number) {
  if (project.installmentAmount && project.installmentAmount > 0) {
    return toCents(project.installmentAmount);
  }

  if (project.installmentCount && project.installmentCount > 0) {
    return Math.round(toCents(project.finalAmount) / project.installmentCount);
  }

  return paymentCount === 1 ? toCents(project.finalAmount) : 0;
}

export function getDebtSchedule(project: DebtProject): DebtPayment[] {
  const dates = getDebtPaymentDates(project);
  const installmentCents = resolveInstallmentCents(project, dates.length);

  if (dates.length === 0 || installmentCents <= 0) {
    return [];
  }

  const finalAmountCents = toCents(project.finalAmount);
  let paidCents = 0;

  return dates.map((date, index) => {
    const remainingCents = Math.max(finalAmountCents - paidCents, 0);
    const amountCents =
      index === dates.length - 1 ? remainingCents : Math.min(installmentCents, remainingCents);
    paidCents += amountCents;

    return {
      projectId: project.id,
      projectName: project.name,
      creditorName: project.creditorName,
      currency: project.currency,
      color: project.color,
      date,
      amount: fromCents(amountCents),
      installmentNumber: index + 1,
      installmentCount: project.installmentCount,
      manualPayment: project.manualPayment,
    };
  });
}

export function getDebtPaymentsForMonth(projects: DebtProject[], selectedMonth: Date) {
  const monthStart = toDateKey(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1));
  const monthEnd = toDateKey(
    new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0),
  );

  return projects
    .flatMap(getDebtSchedule)
    .filter((payment) => payment.date >= monthStart && payment.date <= monthEnd);
}

export function getDebtTotalsByCurrency(payments: DebtPayment[]) {
  return payments.reduce<CurrencyTotals>((totals, payment) => {
    totals[payment.currency] = fromCents(
      toCents(totals[payment.currency] ?? 0) + toCents(payment.amount),
    );
    return totals;
  }, {});
}

export function calculateMonthlyCashFlow(
  incomesByCurrency: CurrencyTotals,
  debtsByCurrency: CurrencyTotals,
  expensesByCurrency: CurrencyTotals = {},
): MonthlyCashFlow {
  const currencies = new Set<CurrencyCode>([
    ...(Object.keys(incomesByCurrency) as CurrencyCode[]),
    ...(Object.keys(debtsByCurrency) as CurrencyCode[]),
    ...(Object.keys(expensesByCurrency) as CurrencyCode[]),
  ]);
  const result: MonthlyCashFlow = {
    incomesByCurrency: {},
    debtsByCurrency: {},
    expensesByCurrency: {},
    outgoingsByCurrency: {},
    netByCurrency: {},
  };

  currencies.forEach((currency) => {
    const incomeCents = toCents(incomesByCurrency[currency] ?? 0);
    const debtCents = toCents(debtsByCurrency[currency] ?? 0);
    const expenseCents = toCents(expensesByCurrency[currency] ?? 0);
    const outgoingCents = debtCents + expenseCents;
    result.incomesByCurrency[currency] = fromCents(incomeCents);
    result.debtsByCurrency[currency] = fromCents(debtCents);
    result.expensesByCurrency[currency] = fromCents(expenseCents);
    result.outgoingsByCurrency[currency] = fromCents(outgoingCents);
    result.netByCurrency[currency] = fromCents(incomeCents - outgoingCents);
  });

  return result;
}
