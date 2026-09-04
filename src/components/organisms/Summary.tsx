import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAppContext } from '@/context';
import type { CurrencyTotals, MonthlyCashFlow } from '@/utils';
import type { SummaryDisplayMode, SummaryMetricKey } from '@/types';
import { useAppTheme } from '@/theme';
import { formatCurrency, formatShortMonthName } from '@/utils';

import { AppText } from '../atoms/AppText';

type SummaryItemProps = {
  hoursLabel: string;
  earningsLabel: string;
  hoursValue: string;
  earningsValue: string;
  defaultDisplayMode: SummaryDisplayMode;
};

type SummaryItemConfig = {
  key: SummaryMetricKey;
  hoursLabel: string;
  earningsLabel: string;
  hoursValue: string;
  earningsValue: string;
};

export type SummaryProps = {
  dailyHours: number;
  weeklyHours: number;
  monthlyHours: number;
  dailyEarnings: CurrencyTotals;
  weeklyEarnings: CurrencyTotals;
  monthlyEarnings: CurrencyTotals;
  monthlyCashFlow: MonthlyCashFlow;
  projectionMonth: Date;
};

type FinancialSummaryItemProps = {
  label: string;
  totals: CurrencyTotals;
  kind: 'income' | 'debt' | 'net';
};

function formatTotals(value: CurrencyTotals, locale: string) {
  const entries = Object.entries(value).filter(([, total]) => typeof total === 'number' && total > 0);

  if (entries.length === 0) {
    return '0.00';
  }

  return entries.map(([currency, total]) => formatCurrency(total ?? 0, locale, currency as 'EUR' | 'USD')).join('\n');
}

function formatHours(value: number) {
  return Number(value.toFixed(2)).toString();
}

function FinancialSummaryItem({ label, totals, kind }: FinancialSummaryItemProps) {
  const { locale } = useAppContext();
  const theme = useAppTheme();
  const entries = Object.entries(totals) as [string, number][];

  return (
    <View style={[styles.item, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <AppText variant="bodySmall" color="muted">
        {label}
      </AppText>
      {entries.length === 0 ? (
        <AppText variant="title" weight="bold">
          0.00
        </AppText>
      ) : (
        entries.map(([currency, amount]) => {
          const signedAmount = kind === 'debt' ? -amount : amount;
          const sign = signedAmount > 0 ? '+' : signedAmount < 0 ? '-' : '';
          const color = signedAmount > 0 ? theme.colors.primary : signedAmount < 0 ? theme.colors.danger : theme.colors.text;

          return (
            <AppText key={currency} variant="title" weight="bold" style={{ color }}>
              {sign}{formatCurrency(Math.abs(signedAmount), locale, currency)}
            </AppText>
          );
        })
      )}
    </View>
  );
}

function SummaryItem({
  hoursLabel,
  earningsLabel,
  hoursValue,
  earningsValue,
  defaultDisplayMode,
}: SummaryItemProps) {
  const theme = useAppTheme();
  const [displayMode, setDisplayMode] = useState<SummaryDisplayMode>(defaultDisplayMode);
  const showEarnings = displayMode === 'earnings';
  const label = showEarnings ? earningsLabel : hoursLabel;
  const value = showEarnings ? earningsValue : hoursValue;

  useEffect(() => {
    setDisplayMode(defaultDisplayMode);
  }, [defaultDisplayMode]);

  return (
    <View
      style={[
        styles.item,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        onPress={() => setDisplayMode((currentValue) => (currentValue === 'hours' ? 'earnings' : 'hours'))}
        style={({ pressed }) => [styles.itemContent, { opacity: pressed ? 0.9 : 1 }]}
      >
        <AppText variant="bodySmall" color="muted">
          {label}
        </AppText>
        <AppText variant="title" weight="bold">
          {value}
        </AppText>
      </Pressable>
    </View>
  );
}

export function Summary({
  dailyHours,
  weeklyHours,
  monthlyHours,
  dailyEarnings,
  weeklyEarnings,
  monthlyEarnings,
  monthlyCashFlow,
  projectionMonth,
}: SummaryProps) {
  const { locale, summaryDisplayPreferences, summaryDisplayPreset, t } = useAppContext();
  const projectionMonthName = formatShortMonthName(projectionMonth, locale);
  const items = useMemo<SummaryItemConfig[]>(
    () => [
      {
        key: 'today',
        hoursLabel: t('summary.hoursToday'),
        earningsLabel: t('summary.todayEarnings'),
        hoursValue: formatHours(dailyHours),
        earningsValue: formatTotals(dailyEarnings, locale),
      },
      {
        key: 'week',
        hoursLabel: t('summary.hoursWeek'),
        earningsLabel: t('summary.weekEarnings'),
        hoursValue: formatHours(weeklyHours),
        earningsValue: formatTotals(weeklyEarnings, locale),
      },
      {
        key: 'month',
        hoursLabel: t('summary.hoursMonth'),
        earningsLabel: t('summary.monthEarnings'),
        hoursValue: formatHours(monthlyHours),
        earningsValue: formatTotals(monthlyEarnings, locale),
      },
    ],
    [
      dailyEarnings,
      dailyHours,
      locale,
      monthlyEarnings,
      monthlyHours,
      t,
      weeklyEarnings,
      weeklyHours,
    ],
  );
  const resolvedDefaultDisplayMode = (itemKey: SummaryMetricKey): SummaryDisplayMode => {
    if (summaryDisplayPreset === 'hours') {
      return 'hours';
    }

    if (summaryDisplayPreset === 'earnings') {
      return 'earnings';
    }

    return summaryDisplayPreferences[itemKey];
  };

  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <SummaryItem
          key={item.key}
          hoursLabel={item.hoursLabel}
          earningsLabel={item.earningsLabel}
          hoursValue={item.hoursValue}
          earningsValue={item.earningsValue}
          defaultDisplayMode={resolvedDefaultDisplayMode(item.key)}
        />
      ))}
      <FinancialSummaryItem
        label={t('summary.monthProjectionIncomes', { month: projectionMonthName })}
        totals={monthlyCashFlow.incomesByCurrency}
        kind="income"
      />
      <FinancialSummaryItem
        label={t('summary.monthProjectionDebts', { month: projectionMonthName })}
        totals={monthlyCashFlow.debtsByCurrency}
        kind="debt"
      />
      <FinancialSummaryItem
        label={t('summary.monthProjectionMoney', { month: projectionMonthName })}
        totals={monthlyCashFlow.netByCurrency}
        kind="net"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  item: {
    borderRadius: 18,
    borderWidth: 1,
    flexBasis: '48.5%',
    padding: 16,
  },
  itemContent: {
    gap: 6,
  },
});
