import type { CreateDebtProjectInput } from '@/types';

export function isEmailValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function parseDecimalInput(value: string) {
  if (!value.trim()) {
    return null;
  }

  const normalizedValue = value.replace(',', '.');
  const parsedValue = Number(normalizedValue);

  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  return Number(parsedValue.toFixed(2));
}

export function isIsoDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export type DebtValidationError =
  | 'required'
  | 'principalAmount'
  | 'finalAmount'
  | 'finalAmountTooLow'
  | 'dateRange'
  | 'installmentCount'
  | 'installmentAmount'
  | 'interestRate';

export function validateDebtProject(input: CreateDebtProjectInput): DebtValidationError | null {
  if (
    !input.name.trim() ||
    !input.creditorName.trim() ||
    !isIsoDateString(input.startDate) ||
    !isIsoDateString(input.paymentStartDate) ||
    !isIsoDateString(input.endDate)
  ) {
    return 'required';
  }

  if (!Number.isFinite(input.principalAmount) || input.principalAmount <= 0) {
    return 'principalAmount';
  }

  if (!Number.isFinite(input.finalAmount) || input.finalAmount <= 0) {
    return 'finalAmount';
  }

  if (input.finalAmount < input.principalAmount) {
    return 'finalAmountTooLow';
  }

  if (input.paymentStartDate < input.startDate || input.endDate < input.paymentStartDate) {
    return 'dateRange';
  }

  if (input.installmentCount !== undefined && (!Number.isInteger(input.installmentCount) || input.installmentCount <= 0)) {
    return 'installmentCount';
  }

  if (input.installmentAmount !== undefined && (!Number.isFinite(input.installmentAmount) || input.installmentAmount <= 0)) {
    return 'installmentAmount';
  }

  if (input.interestRate !== undefined && (!Number.isFinite(input.interestRate) || input.interestRate < 0)) {
    return 'interestRate';
  }

  return null;
}
