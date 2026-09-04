import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAppContext } from '@/context';
import type { IncomeProject, WorkLog } from '@/types';
import { useAppTheme } from '@/theme';
import type { DebtPayment } from '@/utils';
import { calculateDailyEarnings, formatCurrency, formatDate, formatLongDate, fromDateKey, isPaydayForProject, parseDecimalInput } from '@/utils';

import { AppButton } from '../atoms/AppButton';
import { AppInput } from '../atoms/AppInput';
import { AppText } from '../atoms/AppText';

const MAX_HOURS_PER_DAY = 24;

type ProjectChipsProps = {
  projects: IncomeProject[];
  selectedDate: string;
  selectedProjectId: string;
  onSelect: (projectId: string) => void;
};

export type DayDetailsProps = {
  selectedDate: string;
  projects: IncomeProject[];
  debtPayments: DebtPayment[];
  dayLogs: WorkLog[];
  isHoliday: boolean;
  selectedProjectId: string;
  onSelectProject: (projectId: string) => void;
  onSaveHours: (projectId: string, hoursWorked: number) => void;
  onClearHours: (projectId: string) => void;
  onToggleHoliday: () => void;
};

function ProjectChips({ projects, selectedDate, selectedProjectId, onSelect }: ProjectChipsProps) {
  const { locale, t } = useAppContext();
  const theme = useAppTheme();

  return (
    <View style={styles.projectList}>
      {projects.map((project) => {
        const isSelected = project.id === selectedProjectId;
        const isPayday = isPaydayForProject(project, selectedDate);
        const isSpanish = locale.startsWith('es');
        const projectChipContentStyle = isPayday
          ? isSpanish
            ? styles.projectChipContentWithWideBadge
            : styles.projectChipContentWithCompactBadge
          : styles.projectChipContentWithoutBadge;

        return (
          <Pressable
            key={project.id}
            onPress={() => onSelect(project.id)}
            style={[
              styles.projectChip,
              {
                backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceMuted,
                borderColor: isSelected ? theme.colors.primary : theme.colors.border,
              },
            ]}
          >
            {isPayday ? (
              <View
                style={[
                  styles.paydayBadge,
                  {
                    backgroundColor: isSelected ? theme.colors.inverse : theme.colors.surface,
                    borderColor: isSelected ? theme.colors.inverse : theme.colors.border,
                  },
                ]}
              >
                <AppText color={isSelected ? 'primary' : 'text'} variant="label" weight="bold">
                  {t('day.paydayBadge')}
                </AppText>
              </View>
            ) : null}
            <View style={[styles.projectChipContent, projectChipContentStyle]}>
              <AppText
                color={isSelected ? 'inverse' : 'text'}
                weight="semibold"
                numberOfLines={isPayday ? 1 : undefined}
                ellipsizeMode={isPayday ? 'tail' : undefined}
              >
                {project.name}
              </AppText>
              <AppText color={isSelected ? 'inverse' : 'muted'} variant="bodySmall">
                {formatCurrency(project.hourlyRate, locale, project.currency)}/h
              </AppText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function DayDetails({
  selectedDate,
  projects,
  debtPayments,
  dayLogs,
  isHoliday,
  selectedProjectId,
  onSelectProject,
  onSaveHours,
  onClearHours,
  onToggleHoliday,
}: DayDetailsProps) {
  const { locale, t } = useAppContext();
  const theme = useAppTheme();
  const selectedProject = useMemo(() => projects.find((project) => project.id === selectedProjectId), [projects, selectedProjectId]);
  const currentLog = useMemo(() => dayLogs.find((log) => log.projectId === selectedProjectId), [dayLogs, selectedProjectId]);
  const [hoursValue, setHoursValue] = useState('');

  useEffect(() => {
    setHoursValue(currentLog ? String(currentLog.hoursWorked) : '');
  }, [currentLog]);

  useEffect(() => {
    if (!selectedProjectId && projects[0]) {
      onSelectProject(projects[0].id);
    }
  }, [onSelectProject, projects, selectedProjectId]);

  const parsedHours = parseDecimalInput(hoursValue);
  const otherProjectsHours = useMemo(
    () => dayLogs.reduce((total, log) => (log.projectId === selectedProjectId ? total : total + log.hoursWorked), 0),
    [dayLogs, selectedProjectId],
  );
  const wouldExceedDailyLimit = parsedHours !== null && parsedHours > 0 && otherProjectsHours + parsedHours > MAX_HOURS_PER_DAY;
  const canSave = Boolean(selectedProjectId) && parsedHours !== null && parsedHours >= 0 && !wouldExceedDailyLimit;
  const currentEarnings = currentLog && selectedProject ? calculateDailyEarnings(currentLog, selectedProject) : 0;
  const saveButtonLabel = currentLog ? t('common.update') : t('day.saveHours');
  const clearButtonLabel = currentLog ? t('common.delete') : t('common.clear');

  const commitHours = () => {
    if (!canSave || parsedHours === null) {
      return;
    }

    if (parsedHours === 0) {
      onClearHours(selectedProjectId);
      return;
    }

    onSaveHours(selectedProjectId, parsedHours);
  };

  return (
    <View
      style={[
        styles.section,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <AppText variant="title" weight="bold">
        {formatLongDate(selectedDate, locale)}
      </AppText>

      {debtPayments.length > 0 ? (
        <View style={styles.debtSection}>
          <AppText weight="semibold">{t('day.debtPayments')}</AppText>
          {debtPayments.map((payment) => (
            <View
              key={`${payment.projectId}-${payment.installmentNumber}`}
              style={[
                styles.debtCard,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  borderColor: payment.color ?? theme.colors.danger,
                },
              ]}
            >
              <View style={styles.debtTitleRow}>
                <AppText weight="semibold">{payment.projectName}</AppText>
                {payment.manualPayment ? (
                  <AppText color="danger" variant="label" weight="bold">
                    {t('day.manualPayment')}
                  </AppText>
                ) : null}
              </View>
              <AppText color="muted" variant="bodySmall">
                {t('day.debtCreditor', { name: payment.creditorName })}
              </AppText>
              <AppText color="muted" variant="bodySmall">
                {t('day.debtDue', { amount: formatCurrency(payment.amount, locale, payment.currency) })}
              </AppText>
              <AppText color="muted" variant="bodySmall">
                {t('day.debtPaymentDate', { date: formatDate(fromDateKey(payment.date), locale) })}
              </AppText>
              {payment.installmentCount ? (
                <AppText color="muted" variant="bodySmall">
                  {t('day.debtInstallment', { current: payment.installmentNumber, total: payment.installmentCount })}
                </AppText>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {projects.length === 0 ? (
        <AppText color="muted">{t('day.noProjects')}</AppText>
      ) : (
        <>
          <View style={styles.selectionRow}>
            <ProjectChips projects={projects} selectedDate={selectedDate} selectedProjectId={selectedProjectId} onSelect={onSelectProject} />
            <View style={styles.selectionSidebar}>
              <Pressable
                onPress={onToggleHoliday}
                style={[
                  styles.holidayButton,
                  {
                    backgroundColor: isHoliday ? theme.colors.warning : theme.colors.warningSoft,
                    borderColor: theme.colors.warning,
                  },
                ]}
              >
                <AppText
                  style={{
                    color: isHoliday ? theme.colors.inverse : theme.colors.warning,
                  }}
                  weight="semibold"
                >
                  {t('day.holiday')}
                </AppText>
              </Pressable>
            </View>
          </View>

          <View style={styles.inputBlock}>
            <AppText variant="bodySmall" color="muted">
              {t('day.hoursToday')}
            </AppText>
            <AppInput keyboardType="decimal-pad" onBlur={commitHours} onChangeText={setHoursValue} placeholder="0" value={hoursValue} />
            {wouldExceedDailyLimit ? (
              <AppText color="danger" variant="bodySmall">
                {t('day.maxHoursPerDay')}
              </AppText>
            ) : null}
          </View>

          <View style={styles.inlineMeta}>
            <AppText color="muted">
              {selectedProject
                ? t('day.rate', {
                    value: formatCurrency(selectedProject.hourlyRate, locale, selectedProject.currency),
                  })
                : t('day.selectProject')}
            </AppText>
            <AppText color="muted">
              {t('day.earned', {
                value: formatCurrency(currentEarnings, locale, selectedProject?.currency ?? 'EUR'),
              })}
            </AppText>
          </View>

          <View style={styles.buttonRow}>
            <AppButton title={saveButtonLabel} onPress={commitHours} disabled={!canSave} fullWidth={false} />
            <AppButton title={clearButtonLabel} onPress={() => onClearHours(selectedProjectId)} variant="secondary" fullWidth={false} disabled={!currentLog} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 16,
    padding: 20,
  },
  projectList: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  debtSection: {
    gap: 8,
  },
  debtCard: {
    borderLeftWidth: 4,
    borderRadius: 12,
    gap: 3,
    padding: 10,
  },
  debtTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  projectChip: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    gap: 2,
    minWidth: 140,
    paddingHorizontal: 12,
    paddingVertical: 10,
    position: 'relative',
  },
  projectChipContent: {
    gap: 2,
    minHeight: 48,
    paddingTop: 4,
  },
  projectChipContentWithoutBadge: {
    paddingRight: 0,
  },
  projectChipContentWithCompactBadge: {
    paddingRight: 72,
  },
  projectChipContentWithWideBadge: {
    paddingRight: 92,
  },
  paydayBadge: {
    position: 'absolute',
    right: 8,
    top: 8,
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  selectionRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 8,
  },
  selectionSidebar: {
    width: 128,
  },
  inputBlock: {
    gap: 6,
  },
  inlineMeta: {
    gap: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  holidayButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
