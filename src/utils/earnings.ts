import type { CurrencyCode, HolidayLike, IncomeProject, WeekdayEstimationKey, WorkLog } from '@/types';

import { addDays, fromDateKey, toDateKey } from './dateHelpers';

export type CurrencyTotals = Partial<Record<CurrencyCode, number>>;
type ProjectMap = Map<string, IncomeProject>;

export function calculateDailyEarnings(log: WorkLog, project?: IncomeProject) {
  if (!project) {
    return 0;
  }

  return log.hoursWorked * project.hourlyRate;
}

function createProjectMap(projects: IncomeProject[]): ProjectMap {
  return new Map(projects.map((project) => [project.id, project]));
}

function calculateLogsEarnings(logs: WorkLog[], projectMap: ProjectMap) {
  return logs.reduce((total, log) => {
    return total + calculateDailyEarnings(log, projectMap.get(log.projectId));
  }, 0);
}

export function calculateHoursTotal(logs: WorkLog[]) {
  return logs.reduce((total, log) => total + log.hoursWorked, 0);
}

export function calculateWeeklyTotal(logs: WorkLog[], projects: IncomeProject[]) {
  return calculateLogsEarnings(logs, createProjectMap(projects));
}

export function calculateMonthlyTotal(logs: WorkLog[], projects: IncomeProject[]) {
  return calculateLogsEarnings(logs, createProjectMap(projects));
}

export function calculateCurrencyTotals(logs: WorkLog[], projects: IncomeProject[]): CurrencyTotals {
  const projectMap = createProjectMap(projects);

  return logs.reduce<CurrencyTotals>((totals, log) => {
    const project = projectMap.get(log.projectId);

    if (!project) {
      return totals;
    }

    const earnings = calculateDailyEarnings(log, project);
    totals[project.currency] = (totals[project.currency] ?? 0) + earnings;
    return totals;
  }, {});
}

const WEEKDAY_ESTIMATION_KEYS: Record<number, WeekdayEstimationKey> = {
  0: 'sunHours',
  1: 'monHours',
  2: 'tueHours',
  3: 'wedHours',
  4: 'thuHours',
  5: 'friHours',
  6: 'satHours',
};

export function hasWeeklyEstimation(project: IncomeProject) {
  return Boolean(project.weeklyEstimation) && Object.values(project.weeklyEstimation ?? {}).some((value) => value > 0);
}

export type MonthlyProjection = {
  baseProjectedHours: number;
  baseProjectedEarningsByCurrency: CurrencyTotals;
  holidayExtraHours: number;
  holidayExtraEarningsByCurrency: CurrencyTotals;
  loggedDayAdjustmentHours: number;
  loggedDayAdjustmentEarningsByCurrency: CurrencyTotals;
  totalProjectedHours: number;
  totalProjectedEarningsByCurrency: CurrencyTotals;
};

type ProjectionLayerTotals = {
  hours: number;
  earningsByCurrency: CurrencyTotals;
};

function getEstimatedHoursForDate(project: IncomeProject, date: Date) {
  if (!project.weeklyEstimation) {
    return 0;
  }

  const estimationKey = WEEKDAY_ESTIMATION_KEYS[date.getDay()];
  return project.weeklyEstimation[estimationKey] ?? 0;
}

function toHolidayDateSet(holidays: HolidayLike[]) {
  return new Set(holidays.map((holiday) => (typeof holiday === 'string' ? holiday : holiday.date)).filter((date): date is string => Boolean(date)));
}

function addCurrencyValue(totals: CurrencyTotals, currency: CurrencyCode, amount: number) {
  totals[currency] = (totals[currency] ?? 0) + amount;
}

function createProjectionLayerTotals(): ProjectionLayerTotals {
  return {
    hours: 0,
    earningsByCurrency: {},
  };
}

function addToProjectionLayer(layer: ProjectionLayerTotals, currency: CurrencyCode, hours: number, hourlyRate: number) {
  if (hours === 0) {
    return;
  }

  layer.hours += hours;
  addCurrencyValue(layer.earningsByCurrency, currency, hours * hourlyRate);
}

function buildLoggedHoursByProjectDate(workLogs: WorkLog[], monthStartKey: string, monthEndKey: string) {
  return workLogs.reduce<Map<string, Map<string, number>>>((totals, log) => {
    if (log.date < monthStartKey || log.date > monthEndKey) {
      return totals;
    }

    const projectLogs = totals.get(log.projectId) ?? new Map<string, number>();
    projectLogs.set(log.date, (projectLogs.get(log.date) ?? 0) + log.hoursWorked);
    totals.set(log.projectId, projectLogs);
    return totals;
  }, new Map());
}

function mergeCurrencyTotals(...totalsList: CurrencyTotals[]) {
  const mergedTotals: CurrencyTotals = {};

  totalsList.forEach((totals) => {
    Object.entries(totals).forEach(([currency, value]) => {
      if (typeof value !== 'number') {
        return;
      }

      mergedTotals[currency as CurrencyCode] = (mergedTotals[currency as CurrencyCode] ?? 0) + value;
    });
  });

  return mergedTotals;
}

function roundCurrencyTotals(totals: CurrencyTotals) {
  const roundedTotals: CurrencyTotals = {};

  Object.entries(totals).forEach(([currency, value]) => {
    if (typeof value !== 'number') {
      return;
    }

    roundedTotals[currency as CurrencyCode] = Number(value.toFixed(2));
  });

  return roundedTotals;
}

function roundProjectionLayer(layer: ProjectionLayerTotals): ProjectionLayerTotals {
  return {
    hours: Number(layer.hours.toFixed(2)),
    earningsByCurrency: roundCurrencyTotals(layer.earningsByCurrency),
  };
}

function toMonthlyProjection(
  baseLayer: ProjectionLayerTotals,
  holidayExtraLayer: ProjectionLayerTotals,
  loggedAdjustmentLayer: ProjectionLayerTotals,
): MonthlyProjection {
  const roundedBaseLayer = roundProjectionLayer(baseLayer);
  const roundedHolidayExtraLayer = roundProjectionLayer(holidayExtraLayer);
  const roundedLoggedAdjustmentLayer = roundProjectionLayer(loggedAdjustmentLayer);

  return {
    baseProjectedHours: roundedBaseLayer.hours,
    baseProjectedEarningsByCurrency: roundedBaseLayer.earningsByCurrency,
    holidayExtraHours: roundedHolidayExtraLayer.hours,
    holidayExtraEarningsByCurrency: roundedHolidayExtraLayer.earningsByCurrency,
    loggedDayAdjustmentHours: roundedLoggedAdjustmentLayer.hours,
    loggedDayAdjustmentEarningsByCurrency: roundedLoggedAdjustmentLayer.earningsByCurrency,
    totalProjectedHours: Number((roundedBaseLayer.hours + roundedHolidayExtraLayer.hours + roundedLoggedAdjustmentLayer.hours).toFixed(2)),
    totalProjectedEarningsByCurrency: roundCurrencyTotals(
      mergeCurrencyTotals(roundedBaseLayer.earningsByCurrency, roundedHolidayExtraLayer.earningsByCurrency, roundedLoggedAdjustmentLayer.earningsByCurrency),
    ),
  };
}

export function calculateMonthlyProjection(
  projects: IncomeProject[],
  workLogs: WorkLog[],
  holidays: HolidayLike[],
  selectedMonth = new Date(),
): MonthlyProjection {
  const monthStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
  const monthEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);
  const monthStartKey = toDateKey(monthStart);
  const monthEndKey = toDateKey(monthEnd);
  const holidayDateSet = toHolidayDateSet(holidays);
  const projectedProjects = projects.filter(hasWeeklyEstimation);
  const loggedHoursByProjectDate = buildLoggedHoursByProjectDate(workLogs, monthStartKey, monthEndKey);
  const baseLayer = createProjectionLayerTotals();
  const holidayExtraLayer = createProjectionLayerTotals();
  const loggedAdjustmentLayer = createProjectionLayerTotals();

  for (const project of projectedProjects) {
    for (let cursor = monthStart; cursor <= monthEnd; cursor = addDays(cursor, 1)) {
      const dateKey = toDateKey(cursor);

      if (holidayDateSet.has(dateKey)) {
        continue;
      }

      const dayHours = getEstimatedHoursForDate(project, cursor);

      if (dayHours <= 0) {
        continue;
      }

      addToProjectionLayer(baseLayer, project.currency, dayHours, project.hourlyRate);
    }
  }

  for (const project of projectedProjects) {
    const projectLoggedHours = loggedHoursByProjectDate.get(project.id);

    if (!projectLoggedHours) {
      continue;
    }

    for (const [dateKey, actualHours] of projectLoggedHours.entries()) {
      if (holidayDateSet.has(dateKey)) {
        addToProjectionLayer(holidayExtraLayer, project.currency, actualHours, project.hourlyRate);
        continue;
      }

      const estimatedHours = getEstimatedHoursForDate(project, fromDateKey(dateKey));
      const adjustmentHours = actualHours - estimatedHours;

      if (adjustmentHours === 0) {
        continue;
      }

      addToProjectionLayer(loggedAdjustmentLayer, project.currency, adjustmentHours, project.hourlyRate);
    }
  }

  return toMonthlyProjection(baseLayer, holidayExtraLayer, loggedAdjustmentLayer);
}
