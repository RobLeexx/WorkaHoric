import assert from 'node:assert/strict';
import test from 'node:test';

import type { CreateDebtProjectInput, IncomeProject } from '../types';
import {
  calculateMonthlyCashFlow,
  deriveDebtPlan,
  getDebtPaymentsForMonth,
  getDebtSchedule,
  getDebtTotalsByCurrency,
} from './debts';
import { getPaymentIndicatorsForMonth } from './paydays';
import { validateDebtProject } from './validators';

const validDebt: CreateDebtProjectInput = {
  projectKind: 'debt',
  name: 'Car loan',
  currency: 'EUR',
  startDate: '2026-08-15',
  paymentStartDate: '2026-09-01',
  endDate: '2027-08-01',
  debtType: 'financing',
  creditorType: 'company',
  creditorName: 'Example Finance',
  principalAmount: 1000,
  finalAmount: 1100,
  paymentFrequency: 'monthly',
  manualPayment: false,
  installmentCount: 12,
  installmentAmount: 91.67,
  interestRate: 10,
  status: 'active',
};

test('validates the debt CRUD business rules', () => {
  assert.equal(validateDebtProject(validDebt), null);
  assert.equal(validateDebtProject({ ...validDebt, finalAmount: 900 }), 'finalAmountTooLow');
  assert.equal(validateDebtProject({ ...validDebt, endDate: '2026-08-31' }), 'dateRange');
  assert.equal(validateDebtProject({ ...validDebt, installmentCount: 0 }), 'installmentCount');
  assert.equal(validateDebtProject({ ...validDebt, interestRate: -1 }), 'interestRate');

  assert.deepEqual(deriveDebtPlan(1000, 10, 12, 'monthly', '2026-09-01'), {
    finalAmount: 1100,
    installmentAmount: 91.67,
    endDate: '2027-08-01',
  });

  const debt = { ...validDebt, id: 'debt-1', color: '#0EA5E9' as const, manualPayment: true };
  const schedule = getDebtSchedule(debt);
  assert.equal(schedule.length, 12);
  assert.equal(schedule[0].amount, 91.67);
  assert.equal(schedule[11].amount, 91.63);
  assert.equal(
    Math.round(schedule.reduce((total, payment) => total + payment.amount, 0) * 100),
    110000,
  );

  const augustPayments = getDebtPaymentsForMonth([debt], new Date(2027, 7, 1));
  assert.deepEqual(
    augustPayments.map(({ amount, installmentNumber, manualPayment }) => ({
      amount,
      installmentNumber,
      manualPayment,
    })),
    [{ amount: 91.63, installmentNumber: 12, manualPayment: true }],
  );

  const weeklyDebt = {
    ...debt,
    id: 'debt-2',
    startDate: '2026-09-01',
    paymentStartDate: '2026-09-01',
    endDate: '2026-09-29',
    paymentFrequency: 'weekly' as const,
    installmentCount: 5,
    installmentAmount: 50,
    finalAmount: 250,
  };
  const debtTotals = getDebtTotalsByCurrency(
    getDebtPaymentsForMonth([weeklyDebt], new Date(2026, 8, 1)),
  );
  assert.deepEqual(debtTotals, { EUR: 250 });
  assert.deepEqual(calculateMonthlyCashFlow({ EUR: 810, USD: 100 }, { EUR: 250, USD: 125 }), {
    incomesByCurrency: { EUR: 810, USD: 100 },
    debtsByCurrency: { EUR: 250, USD: 125 },
    netByCurrency: { EUR: 560, USD: -25 },
  });

  const derivedSchedule = getDebtSchedule({ ...debt, installmentAmount: undefined });
  assert.equal(derivedSchedule[0].amount, 91.67);
  assert.equal(derivedSchedule[11].amount, 91.63);
  const singlePayment = getDebtSchedule({
    ...debt,
    paymentFrequency: 'custom',
    installmentCount: 1,
    installmentAmount: undefined,
    endDate: debt.paymentStartDate,
  });
  assert.equal(singlePayment.length, 1);
  assert.equal(singlePayment[0].date, debt.paymentStartDate);
  assert.equal(singlePayment[0].amount, debt.finalAmount);

  const incomes: IncomeProject[] = [
    createIncomeProject('income-1', '#EF4444'),
    createIncomeProject('income-2', '#10B981'),
  ];
  const indicators = getPaymentIndicatorsForMonth(
    incomes,
    getDebtPaymentsForMonth([weeklyDebt], new Date(2026, 8, 1)),
    new Date(2026, 8, 1),
  );
  assert.deepEqual(
    indicators['2026-09-01']?.map(({ kind, color }) => ({ kind, color })),
    [
      { kind: 'income', color: '#EF4444' },
      { kind: 'income', color: '#10B981' },
      { kind: 'debt', color: '#0EA5E9' },
    ],
  );
});

function createIncomeProject(id: string, color: IncomeProject['color']): IncomeProject {
  return {
    id,
    projectKind: 'income',
    name: id,
    currency: 'EUR',
    startDate: '2026-01-01',
    color,
    hourlyRate: 10,
    contractType: 'hourly',
    paymentRule: { type: 'one_time', paymentDate: '2026-09-01' },
  };
}
