import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppButton, AppText, MainLayout } from '@/components';
import { useAppTheme } from '@/theme';
import { useSettings } from '@/hooks';
import type { AppLanguage, SummaryDisplayMode, SummaryDisplayPreset, ThemeMode, WeekStart } from '@/types';

type OptionSelectorProps<T extends string> = {
  label: string;
  value: T;
  options: readonly { label: string; value: T }[];
  onChange: (value: T) => void;
};

function OptionSelector<T extends string>({ label, value, options, onChange }: OptionSelectorProps<T>) {
  const theme = useAppTheme();

  return (
    <View style={styles.group}>
      <AppText weight="semibold">{label}</AppText>
      <View style={styles.optionRow}>
        {options.map((option) => {
          const isSelected = option.value === value;

          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[
                styles.optionChip,
                {
                  backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceMuted,
                  borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                },
              ]}
            >
              <AppText color={isSelected ? 'inverse' : 'text'} weight="semibold">
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function SettingsScreen() {
  const theme = useAppTheme();
  const {
    language,
    resetData,
    setLanguage,
    setSummaryDisplayPreference,
    setSummaryDisplayPreset,
    setThemeMode,
    setWeekStart,
    summaryDisplayPreferences,
    summaryDisplayPreset,
    t,
    themeMode,
    weekStart,
  } = useSettings();
  const [showResetModal, setShowResetModal] = useState(false);

  return (
    <>
      <MainLayout title={t('settings.title')} showHeader={false}>
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <OptionSelector<AppLanguage>
            label={t('settings.language')}
            value={language}
            options={[
              { label: t('settings.english'), value: 'en' },
              { label: t('settings.spanish'), value: 'es' },
            ]}
            onChange={setLanguage}
          />
          <OptionSelector<ThemeMode>
            label={t('settings.theme')}
            value={themeMode}
            options={[
              { label: t('settings.light'), value: 'light' },
              { label: t('settings.dark'), value: 'dark' },
            ]}
            onChange={setThemeMode}
          />
          <OptionSelector<WeekStart>
            label={t('settings.weekStart')}
            value={weekStart}
            options={[
              { label: t('settings.monday'), value: 'monday' },
              { label: t('settings.sunday'), value: 'sunday' },
            ]}
            onChange={setWeekStart}
          />
          <OptionSelector<SummaryDisplayPreset>
            label={t('settings.homeSummaryDefault')}
            value={summaryDisplayPreset}
            options={[
              { label: t('settings.homeSummaryHours'), value: 'hours' },
              { label: t('settings.homeSummaryEarnings'), value: 'earnings' },
              { label: t('settings.homeSummaryCustom'), value: 'custom' },
            ]}
            onChange={setSummaryDisplayPreset}
          />
          {summaryDisplayPreset === 'custom' ? (
            <View style={styles.group}>
              <AppText weight="semibold">{t('settings.homeSummaryCustom')}</AppText>
              <AppText color="muted">{t('settings.homeSummaryCustomDescription')}</AppText>
              <OptionSelector<SummaryDisplayMode>
                label={t('summary.hoursToday')}
                value={summaryDisplayPreferences.today}
                options={[
                  { label: t('settings.homeSummaryHours'), value: 'hours' },
                  { label: t('settings.homeSummaryEarnings'), value: 'earnings' },
                ]}
                onChange={(value) => setSummaryDisplayPreference('today', value)}
              />
              <OptionSelector<SummaryDisplayMode>
                label={t('summary.hoursWeek')}
                value={summaryDisplayPreferences.week}
                options={[
                  { label: t('settings.homeSummaryHours'), value: 'hours' },
                  { label: t('settings.homeSummaryEarnings'), value: 'earnings' },
                ]}
                onChange={(value) => setSummaryDisplayPreference('week', value)}
              />
              <OptionSelector<SummaryDisplayMode>
                label={t('summary.hoursMonth')}
                value={summaryDisplayPreferences.month}
                options={[
                  { label: t('settings.homeSummaryHours'), value: 'hours' },
                  { label: t('settings.homeSummaryEarnings'), value: 'earnings' },
                ]}
                onChange={(value) => setSummaryDisplayPreference('month', value)}
              />
            </View>
          ) : null}
          <View
            style={[
              styles.group,
              styles.dangerSection,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <AppText weight="bold" color="text">
              {t('settings.resetData')}
            </AppText>
            <AppText color="muted">{t('settings.resetDescription')}</AppText>
            <AppButton
              title={t('settings.resetData')}
              onPress={() => setShowResetModal(true)}
              style={{
                backgroundColor: theme.colors.danger,
                borderColor: theme.colors.danger,
              }}
              textStyle={{
                color: theme.colors.inverse,
              }}
              fullWidth={false}
            />
          </View>
        </View>
      </MainLayout>

      <Modal animationType="fade" transparent visible={showResetModal} onRequestClose={() => setShowResetModal(false)}>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <AppText variant="title" weight="bold" color="danger">
              {t('settings.resetConfirmTitle')}
            </AppText>
            <AppText color="muted">{t('settings.resetConfirmBody')}</AppText>
            <View style={styles.modalActions}>
              <AppButton
                title={t('common.cancel')}
                onPress={() => setShowResetModal(false)}
                variant="secondary"
                fullWidth={false}
              />
              <AppButton
                title={t('common.reset')}
                style={{
                  backgroundColor: theme.colors.danger,
                  borderColor: theme.colors.danger,
                }}
                textStyle={{
                  color: theme.colors.inverse,
                }}
                onPress={() => {
                  resetData();
                  setShowResetModal(false);
                }}
                fullWidth={false}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 20,
    padding: 20,
  },
  group: {
    gap: 10,
  },
  dangerSection: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionChip: {
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 110,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    maxWidth: 420,
    padding: 20,
    width: '100%',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
});
