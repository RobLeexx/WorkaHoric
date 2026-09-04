import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppButton, AppText, DayDetails, MainLayout, Summary, WorkCalendar } from '@/components';
import { useAppContext } from '@/context';
import { useProjects, useWorkLogs } from '@/hooks';
import { useAppTheme } from '@/theme';
import { isDebtProject } from '@/types';
import {
  addMonths,
  calculateMonthlyCashFlow,
  calculateMonthlyProjection,
  fromDateKey,
  getDebtPaymentsForMonth,
  getDebtTotalsByCurrency,
  getPaymentIndicatorsForMonth,
  toDateKey,
} from '@/utils';

const SHEET_ANIMATION_DURATION_MS = 220;
const SHEET_HIDDEN_OFFSET = 520;

export function HomeScreen() {
  const { holidayDates, isHydrated, showToast, t, toggleHoliday } = useAppContext();
  const { projects, managedProjects } = useProjects();
  const theme = useAppTheme();
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState(toDateKey(today));
  const [visibleMonth, setVisibleMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [isDayDetailsMounted, setDayDetailsMounted] = useState(false);
  const sheetAnimation = useRef(new Animated.Value(0)).current;
  const {
    workLogs,
    dayLogs,
    setHoursForProject,
    clearHoursForProject,
    dailyHours,
    weeklyHours,
    monthlyHours,
    dailyEarningsByCurrency,
    weeklyEarningsByCurrency,
    monthlyEarningsByCurrency,
  } = useWorkLogs(selectedDate);
  const debtProjects = useMemo(() => managedProjects.filter(isDebtProject), [managedProjects]);
  const debtPayments = useMemo(() => getDebtPaymentsForMonth(debtProjects, visibleMonth), [debtProjects, visibleMonth]);
  const paymentIndicators = useMemo(
    () => getPaymentIndicatorsForMonth(projects, debtPayments, visibleMonth),
    [debtPayments, projects, visibleMonth],
  );
  const projectIds = useMemo(() => new Set(projects.map((project) => project.id)), [projects]);
  const monthlyProjection = useMemo(
    () => calculateMonthlyProjection(projects, workLogs, holidayDates, visibleMonth),
    [holidayDates, projects, visibleMonth, workLogs],
  );
  const monthlyCashFlow = useMemo(
    () => calculateMonthlyCashFlow(monthlyProjection.totalProjectedEarningsByCurrency, getDebtTotalsByCurrency(debtPayments)),
    [debtPayments, monthlyProjection.totalProjectedEarningsByCurrency],
  );
  const selectedDebtPayments = useMemo(() => debtPayments.filter((payment) => payment.date === selectedDate), [debtPayments, selectedDate]);

  const syncSelectedDate = useCallback((dateKey: string) => {
    setSelectedDate(dateKey);
    const date = fromDateKey(dateKey);
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }, []);

  const getPreferredProjectIdForDate = useCallback((dateKey: string) => {
    const existingDayLog = workLogs.find((log) => log.date === dateKey && projectIds.has(log.projectId));

    if (existingDayLog) {
      return existingDayLog.projectId;
    }

    if (projects.some((project) => project.id === selectedProjectId)) {
      return selectedProjectId;
    }

    return projects[0]?.id ?? '';
  }, [projectIds, projects, selectedProjectId, workLogs]);

  const openDayDetails = useCallback((dateKey: string) => {
    syncSelectedDate(dateKey);
    setSelectedProjectId(getPreferredProjectIdForDate(dateKey));
    setDayDetailsMounted(true);
  }, [getPreferredProjectIdForDate, syncSelectedDate]);

  const closeDayDetails = useCallback(() => {
    Animated.timing(sheetAnimation, {
      toValue: 0,
      duration: SHEET_ANIMATION_DURATION_MS,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setDayDetailsMounted(false);
      }
    });
  }, [sheetAnimation]);

  useEffect(() => {
    if (!isDayDetailsMounted) {
      sheetAnimation.setValue(0);
      return;
    }

    Animated.timing(sheetAnimation, {
      toValue: 1,
      duration: SHEET_ANIMATION_DURATION_MS,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [isDayDetailsMounted, sheetAnimation]);

  useEffect(() => {
    if (projects.length === 0) {
      setSelectedProjectId('');
      return;
    }

    if (!projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const changeMonth = useCallback((direction: 'previous' | 'next') => {
    const nextMonth = addMonths(visibleMonth, direction === 'previous' ? -1 : 1);
    setVisibleMonth(nextMonth);
    setSelectedDate(toDateKey(nextMonth));
  }, [visibleMonth]);
  const handleSaveHours = useCallback(
    (projectId: string, hoursWorked: number) => {
      const project = projects.find((item) => item.id === projectId);
      const existingLog = dayLogs.find((log) => log.projectId === projectId);

      setHoursForProject(projectId, hoursWorked);

      if (!project) {
        return;
      }

      showToast({
        type: existingLog ? 'info' : 'success',
        title: t('feedback.successTitle'),
        message: existingLog
          ? t('feedback.hoursUpdated', { name: project.name })
          : t('feedback.hoursSaved', { name: project.name }),
      });
    },
    [dayLogs, projects, setHoursForProject, showToast, t],
  );
  const handleClearHours = useCallback(
    (projectId: string) => {
      const project = projects.find((item) => item.id === projectId);
      const existingLog = dayLogs.find((log) => log.projectId === projectId);

      if (!existingLog) {
        return;
      }

      clearHoursForProject(projectId);

      if (!project) {
        return;
      }

      showToast({
        type: 'danger',
        title: t('feedback.successTitle'),
        message: t('feedback.hoursDeleted', { name: project.name }),
      });
    },
    [clearHoursForProject, dayLogs, projects, showToast, t],
  );
  const handleToggleHoliday = useCallback(() => {
    const willBecomeHoliday = !holidayDates.includes(selectedDate);

    toggleHoliday(selectedDate);
    showToast({
      type: willBecomeHoliday ? 'warning' : 'info',
      title: t('feedback.successTitle'),
      message: willBecomeHoliday ? t('feedback.holidayAdded') : t('feedback.holidayRemoved'),
    });
  }, [holidayDates, selectedDate, showToast, t, toggleHoliday]);

  const sheetTranslateY = sheetAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [SHEET_HIDDEN_OFFSET, 0],
  });

  return (
    <View style={styles.screen}>
      <MainLayout contentContainerStyle={styles.content} showHeader={false} title={t('header.home')}>
        {!isHydrated ? <AppText color="muted">{t('common.loadingSavedData')}</AppText> : null}

        <WorkCalendar
          selectedDate={selectedDate}
          visibleMonth={visibleMonth}
          holidayDates={holidayDates}
          paymentIndicators={paymentIndicators}
          workLogs={workLogs}
          onSelectDate={syncSelectedDate}
          onOpenDate={openDayDetails}
          onChangeMonth={changeMonth}
        />

        <Summary
          dailyHours={dailyHours}
          weeklyHours={weeklyHours}
          monthlyHours={monthlyHours}
          dailyEarnings={dailyEarningsByCurrency}
          weeklyEarnings={weeklyEarningsByCurrency}
          monthlyEarnings={monthlyEarningsByCurrency}
          monthlyCashFlow={monthlyCashFlow}
          projectionMonth={visibleMonth}
        />
      </MainLayout>

      {isDayDetailsMounted ? (
        <View pointerEvents="box-none" style={styles.sheetLayer}>
          <Pressable style={styles.sheetBackdropPressable} onPress={closeDayDetails}>
            <Animated.View
              style={[
                styles.sheetBackdrop,
                {
                  opacity: sheetAnimation,
                },
              ]}
            />
          </Pressable>

          <Animated.View
            style={[
              styles.sheetContainer,
              {
                transform: [{ translateY: sheetTranslateY }],
              },
            ]}
          >
            <View style={styles.sheetHandleWrapper}>
              <View
                style={[
                  styles.sheetHandle,
                  {
                    backgroundColor: theme.colors.borderStrong,
                  },
                ]}
              />
            </View>
            <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
              <DayDetails
                selectedDate={selectedDate}
                projects={projects}
                debtPayments={selectedDebtPayments}
                dayLogs={dayLogs}
                isHoliday={holidayDates.includes(selectedDate)}
                selectedProjectId={selectedProjectId}
                onSelectProject={setSelectedProjectId}
                onSaveHours={handleSaveHours}
                onClearHours={handleClearHours}
                onToggleHoliday={handleToggleHoliday}
              />
              <View
                style={[
                  styles.sheetActions,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <AppButton title={t('common.close')} onPress={closeDayDetails} variant="secondary" />
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: 16,
  },
  sheetLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  sheetBackdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  sheetContainer: {
    maxHeight: '92%',
    padding: 16,
    paddingTop: 8,
  },
  sheetContent: {
    gap: 8,
  },
  sheetHandleWrapper: {
    alignItems: 'center',
    marginBottom: 8,
  },
  sheetHandle: {
    borderRadius: 999,
    height: 5,
    width: 44,
  },
  sheetActions: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
});
