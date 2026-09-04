import assert from 'node:assert/strict';
import test from 'node:test';

import type { ExpenseProject } from '@/types';

import { calculateMonthlyCashFlow } from './debts';
import { getExpenseOccurrencesForMonth, getExpenseTotalsByCurrency } from './expenses';
import { validateExpenseProject } from './validators';

const expense: ExpenseProject = {
  id: 'expense-1',
  projectKind: 'expense',
  name: 'Netflix',
  expenseType: 'subscription',
  providerType: 'company',
  providerName: 'Netflix',
  amount: 15,
  currency: 'EUR',
  startDate: '2026-09-05',
  recurrenceType: 'monthly',
  status: 'active',
};

test('calculates and validates expense recurrences and monthly cash flow', () => {
  assert.equal(validateExpenseProject(expense), null);
  assert.equal(validateExpenseProject({ ...expense, amount: 0 }), 'amount');
  assert.equal(validateExpenseProject({ ...expense, recurrenceType: 'every_n_days' }), 'validityDays');
  assert.equal(validateExpenseProject({ ...expense, endDate: '2026-09-04' }), 'dateRange');

  assert.deepEqual(
    getExpenseOccurrencesForMonth([expense], new Date(2026, 9, 1)).map(({ date, amount }) => ({ date, amount })),
    [{ date: '2026-10-05', amount: 15 }],
  );

  const everyThirtyDays = { ...expense, id: 'expense-2', name: 'Mobilis', amount: 20, recurrenceType: 'every_n_days' as const, validityDays: 30 };
  assert.deepEqual(
    getExpenseOccurrencesForMonth([everyThirtyDays], new Date(2026, 10, 1)).map(({ date }) => date),
    ['2026-11-04'],
  );

  const oneTime = { ...expense, id: 'expense-3', amount: 800, recurrenceType: 'one_time' as const, startDate: '2026-09-20' };
  assert.equal(getExpenseOccurrencesForMonth([oneTime], new Date(2026, 8, 1)).length, 1);
  assert.equal(getExpenseOccurrencesForMonth([oneTime], new Date(2026, 9, 1)).length, 0);

  const weekly = { ...expense, id: 'expense-4', amount: 10, recurrenceType: 'weekly' as const, startDate: '2026-09-01' };
  const inactive = { ...expense, id: 'expense-5', status: 'paused' as const };
  const totals = getExpenseTotalsByCurrency(getExpenseOccurrencesForMonth([weekly, inactive], new Date(2026, 8, 1)));
  assert.deepEqual(totals, { EUR: 50 });

  const yearly = { ...expense, id: 'expense-6', recurrenceType: 'yearly' as const, startDate: '2024-02-29' };
  assert.deepEqual(
    getExpenseOccurrencesForMonth([yearly], new Date(2025, 1, 1)).map(({ date }) => date),
    ['2025-02-28'],
  );
  assert.equal(getExpenseOccurrencesForMonth([{ ...expense, endDate: '2026-09-30' }], new Date(2026, 9, 1)).length, 0);

  assert.deepEqual(calculateMonthlyCashFlow({ EUR: 1500, USD: 500 }, { EUR: 300 }, { EUR: 250, USD: 100 }), {
    incomesByCurrency: { EUR: 1500, USD: 500 },
    debtsByCurrency: { EUR: 300, USD: 0 },
    expensesByCurrency: { EUR: 250, USD: 100 },
    outgoingsByCurrency: { EUR: 550, USD: 100 },
    netByCurrency: { EUR: 950, USD: 400 },
  });
});
