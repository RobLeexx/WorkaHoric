import assert from 'node:assert/strict';
import test from 'node:test';

import type { CreateDebtProjectInput } from '../types';
import { validateDebtProject } from './validators';

const validDebt: CreateDebtProjectInput = {
  projectKind: 'debt',
  name: 'Car loan',
  currency: 'EUR',
  startDate: '2026-09-01',
  endDate: '2027-09-01',
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
});
