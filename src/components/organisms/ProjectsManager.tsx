import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Image, Linking, Modal, Pressable, StyleSheet, Switch, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

import { useAppContext } from '@/context';
import type {
  CreditorType,
  ContractFile,
  ContractType,
  CreateDebtProjectInput,
  CreateProjectInput,
  CurrencyCode,
  DebtStatus,
  DebtType,
  PaymentFrequency,
  PaymentRule,
  PaymentType,
  PaymentWeekday,
  Project,
  ProjectColor,
  ProjectKind,
  UpdateProjectInput,
  WeekdayEstimationKey,
  WeeklyEstimation,
} from '@/types';
import { useAppTheme } from '@/theme';
import { formatCurrency, formatDate, fromDateKey, hasWeeklyEstimation, parseDecimalInput, toDateKey, validateDebtProject } from '@/utils';

import { AppButton } from '../atoms/AppButton';
import { AppInput } from '../atoms/AppInput';
import { AppText } from '../atoms/AppText';
import { DateField } from '../molecules/DateField';

const CONTRACT_TYPES: ContractType[] = ['hourly', 'temporary', 'part-time', 'full-time', 'freelance'];
const CURRENCIES: CurrencyCode[] = ['EUR', 'USD'];
const PAYMENT_TYPES: PaymentType[] = ['one_time', 'monthly_fixed_day', 'weekly', 'biweekly'];
const PROJECT_KINDS: ProjectKind[] = ['income', 'debt'];
const DEBT_TYPES: DebtType[] = ['financing', 'personal_loan', 'bank_loan', 'credit', 'mortgage', 'installment_purchase', 'other'];
const CREDITOR_TYPES: CreditorType[] = ['company', 'person'];
const PAYMENT_FREQUENCIES: PaymentFrequency[] = ['weekly', 'biweekly', 'monthly', 'custom'];
const DEBT_STATUSES: DebtStatus[] = ['active', 'completed', 'paused'];
const PROJECT_COLOR_PRESETS: { value: ProjectColor; labelKey: string }[] = [
  { value: '#EF4444', labelKey: 'projects.red' },
  { value: '#F97316', labelKey: 'projects.orange' },
  { value: '#10B981', labelKey: 'projects.green' },
  { value: '#14B8A6', labelKey: 'projects.teal' },
  { value: '#0EA5E9', labelKey: 'projects.blue' },
  { value: '#6366F1', labelKey: 'projects.indigo' },
  { value: '#8B5CF6', labelKey: 'projects.purple' },
  { value: '#EC4899', labelKey: 'projects.pink' },
];
const PAYMENT_WEEKDAY_OPTIONS: { value: PaymentWeekday; labelKey: string }[] = [
  { value: 1, labelKey: 'projects.monHours' },
  { value: 2, labelKey: 'projects.tueHours' },
  { value: 3, labelKey: 'projects.wedHours' },
  { value: 4, labelKey: 'projects.thuHours' },
  { value: 5, labelKey: 'projects.friHours' },
  { value: 6, labelKey: 'projects.satHours' },
  { value: 0, labelKey: 'projects.sunHours' },
];
const WEEKDAY_FIELDS: { key: WeekdayEstimationKey; labelKey: string }[] = [
  { key: 'monHours', labelKey: 'projects.monHours' },
  { key: 'tueHours', labelKey: 'projects.tueHours' },
  { key: 'wedHours', labelKey: 'projects.wedHours' },
  { key: 'thuHours', labelKey: 'projects.thuHours' },
  { key: 'friHours', labelKey: 'projects.friHours' },
  { key: 'satHours', labelKey: 'projects.satHours' },
  { key: 'sunHours', labelKey: 'projects.sunHours' },
];
const EMPTY_WEEKLY_ESTIMATION: WeeklyEstimation = {
  monHours: 0,
  tueHours: 0,
  wedHours: 0,
  thuHours: 0,
  friHours: 0,
  satHours: 0,
  sunHours: 0,
};

function toWeeklyEstimationState(weeklyEstimation?: WeeklyEstimation): Record<WeekdayEstimationKey, string> {
  return {
    monHours: weeklyEstimation?.monHours ? String(weeklyEstimation.monHours) : '',
    tueHours: weeklyEstimation?.tueHours ? String(weeklyEstimation.tueHours) : '',
    wedHours: weeklyEstimation?.wedHours ? String(weeklyEstimation.wedHours) : '',
    thuHours: weeklyEstimation?.thuHours ? String(weeklyEstimation.thuHours) : '',
    friHours: weeklyEstimation?.friHours ? String(weeklyEstimation.friHours) : '',
    satHours: weeklyEstimation?.satHours ? String(weeklyEstimation.satHours) : '',
    sunHours: weeklyEstimation?.sunHours ? String(weeklyEstimation.sunHours) : '',
  };
}

type PaymentRuleFormValues = {
  paymentType: PaymentType;
  paymentDate: string;
  paymentDayOfMonth: string;
  paymentWeekday: PaymentWeekday;
  paymentStartDate: string;
};

function toPaymentRuleFormValues(paymentRule: PaymentRule | undefined, startDate: string): PaymentRuleFormValues {
  const fallbackDate = startDate || toDateKey(new Date());
  const fallbackWeekday = fromDateKey(fallbackDate).getDay() as PaymentWeekday;

  switch (paymentRule?.type) {
    case 'one_time':
      return {
        paymentType: 'one_time',
        paymentDate: paymentRule.paymentDate,
        paymentDayOfMonth: String(fromDateKey(paymentRule.paymentDate).getDate()),
        paymentWeekday: fromDateKey(paymentRule.paymentDate).getDay() as PaymentWeekday,
        paymentStartDate: paymentRule.paymentDate,
      };
    case 'monthly_fixed_day':
      return {
        paymentType: 'monthly_fixed_day',
        paymentDate: fallbackDate,
        paymentDayOfMonth: String(paymentRule.paymentDayOfMonth),
        paymentWeekday: fallbackWeekday,
        paymentStartDate: fallbackDate,
      };
    case 'weekly':
      return {
        paymentType: 'weekly',
        paymentDate: fallbackDate,
        paymentDayOfMonth: String(fromDateKey(fallbackDate).getDate()),
        paymentWeekday: paymentRule.paymentWeekday,
        paymentStartDate: fallbackDate,
      };
    case 'biweekly':
      return {
        paymentType: 'biweekly',
        paymentDate: fallbackDate,
        paymentDayOfMonth: String(fromDateKey(fallbackDate).getDate()),
        paymentWeekday: paymentRule.paymentWeekday ?? (fromDateKey(paymentRule.paymentStartDate).getDay() as PaymentWeekday),
        paymentStartDate: paymentRule.paymentStartDate,
      };
    default:
      return {
        paymentType: 'one_time',
        paymentDate: fallbackDate,
        paymentDayOfMonth: String(fromDateKey(fallbackDate).getDate()),
        paymentWeekday: fallbackWeekday,
        paymentStartDate: fallbackDate,
      };
  }
}

function buildPaymentRule(values: PaymentRuleFormValues): PaymentRule | undefined {
  switch (values.paymentType) {
    case 'one_time':
      return values.paymentDate
        ? {
            type: 'one_time',
            paymentDate: values.paymentDate,
          }
        : undefined;
    case 'monthly_fixed_day': {
      const paymentDayOfMonth = Number(values.paymentDayOfMonth);

      if (!Number.isInteger(paymentDayOfMonth) || paymentDayOfMonth < 1 || paymentDayOfMonth > 31) {
        return undefined;
      }

      return {
        type: 'monthly_fixed_day',
        paymentDayOfMonth,
      };
    }
    case 'weekly':
      return {
        type: 'weekly',
        paymentWeekday: values.paymentWeekday,
      };
    case 'biweekly':
      return values.paymentStartDate
        ? {
            type: 'biweekly',
            paymentStartDate: values.paymentStartDate,
          }
        : undefined;
    default:
      return undefined;
  }
}

type DebtFormValues = {
  debtType: DebtType;
  creditorType: CreditorType;
  creditorName: string;
  principalAmount: string;
  finalAmount: string;
  interestRate: string;
  paymentFrequency: PaymentFrequency;
  manualPayment: boolean;
  installmentCount: string;
  installmentAmount: string;
  endDate: string;
  notes: string;
  status: DebtStatus;
};

function createEmptyDebtValues(date: string): DebtFormValues {
  return {
    debtType: 'financing',
    creditorType: 'company',
    creditorName: '',
    principalAmount: '',
    finalAmount: '',
    interestRate: '',
    paymentFrequency: 'monthly',
    manualPayment: false,
    installmentCount: '',
    installmentAmount: '',
    endDate: date,
    notes: '',
    status: 'active',
  };
}

function parseOptionalDecimal(value: string) {
  return value.trim() ? (parseDecimalInput(value) ?? Number.NaN) : undefined;
}

function buildDebtInput(name: string, currency: CurrencyCode, startDate: string, color: ProjectColor | null, values: DebtFormValues): CreateDebtProjectInput {
  return {
    projectKind: 'debt',
    name,
    currency,
    startDate,
    color,
    debtType: values.debtType,
    creditorType: values.creditorType,
    creditorName: values.creditorName,
    principalAmount: parseDecimalInput(values.principalAmount) ?? Number.NaN,
    finalAmount: parseDecimalInput(values.finalAmount) ?? Number.NaN,
    interestRate: parseOptionalDecimal(values.interestRate),
    paymentFrequency: values.paymentFrequency,
    manualPayment: values.manualPayment,
    installmentCount: values.installmentCount.trim() ? Number(values.installmentCount) : undefined,
    installmentAmount: parseOptionalDecimal(values.installmentAmount),
    endDate: values.endDate,
    notes: values.notes.trim() || undefined,
    status: values.status,
  };
}

function getProjectFormDraft(values: ProjectFormValues) {
  return {
    projectKind: values.projectKind,
    name: values.name,
    hourlyRate: values.hourlyRate,
    currency: values.currency,
    contractType: values.contractType,
    startDate: values.startDate,
    color: values.color ?? null,
    paymentRuleValues: toPaymentRuleFormValues(values.paymentRule, values.startDate),
    isEstimationOpen: Boolean(values.weeklyEstimation),
    weeklyEstimation: toWeeklyEstimationState(values.weeklyEstimation),
    contractFile: values.contractFile ?? null,
    debt: values.debt,
  };
}

type ContractTypeSelectorProps = {
  value: ContractType;
  onChange: (value: ContractType) => void;
};

type ChoiceSelectorProps<T extends string> = {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
};

type ProjectFormValues = {
  projectKind: ProjectKind;
  name: string;
  hourlyRate: string;
  currency: CurrencyCode;
  contractType: ContractType;
  startDate: string;
  color?: ProjectColor | null;
  paymentRule?: PaymentRule;
  weeklyEstimation?: WeeklyEstimation;
  contractFile?: ContractFile;
  debt: DebtFormValues;
};

type ProjectFormProps = {
  title?: string;
  submitLabel: string;
  initialValues: ProjectFormValues;
  onSubmit: (values: CreateProjectInput | UpdateProjectInput) => void;
  onCancel?: () => void;
  embedded?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
};

export type ProjectFormHandle = {
  hasUnsavedChanges: () => boolean;
  submit: () => boolean;
};

export type ProjectsManagerProps = {
  projects: Project[];
  onCreateProject: (input: CreateProjectInput) => Project | null;
  onUpdateProject: (id: string, updates: UpdateProjectInput) => void;
  onDeleteProject: (id: string) => void;
  defaultOpen?: boolean;
  showToggle?: boolean;
};

function ContractTypeSelector({ value, onChange }: ContractTypeSelectorProps) {
  const { t } = useAppContext();
  const theme = useAppTheme();

  return (
    <View style={styles.typeList}>
      {CONTRACT_TYPES.map((type) => {
        const isSelected = type === value;

        return (
          <Pressable
            key={type}
            onPress={() => onChange(type)}
            style={[
              styles.typeChip,
              {
                backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceMuted,
                borderColor: isSelected ? theme.colors.primary : theme.colors.border,
              },
            ]}
          >
            <AppText color={isSelected ? 'inverse' : 'text'} variant="bodySmall" weight="semibold">
              {t(`projects.${type}`)}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function ChoiceSelector<T extends string>({ label, value, options, onChange }: ChoiceSelectorProps<T>) {
  const { t } = useAppContext();
  const theme = useAppTheme();

  return (
    <View style={styles.fieldBlock}>
      <AppText variant="bodySmall" color="muted">
        {label}
      </AppText>
      <View style={styles.typeList}>
        {options.map((option) => {
          const isSelected = option === value;

          return (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              style={[
                styles.typeChip,
                {
                  backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceMuted,
                  borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                },
              ]}
            >
              <AppText color={isSelected ? 'inverse' : 'text'} variant="bodySmall" weight="semibold">
                {t(`projects.${option}`)}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ContractPreview({ contractFile }: { contractFile?: ContractFile }) {
  const { t } = useAppContext();
  const theme = useAppTheme();

  if (!contractFile) {
    return (
      <AppText color="muted" variant="bodySmall">
        {t('projects.noContract')}
      </AppText>
    );
  }

  const isImage = contractFile.mimeType.startsWith('image/');
  const isPdf = contractFile.mimeType === 'application/pdf';

  return (
    <View style={styles.previewBlock}>
      <AppText variant="bodySmall" weight="semibold">
        {contractFile.name}
      </AppText>
      {isImage ? <Image source={{ uri: contractFile.uri }} style={styles.previewImage} resizeMode="cover" /> : null}
      {isPdf ? (
        <View
          style={[
            styles.pdfPreview,
            {
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surfaceMuted,
            },
          ]}
        >
          <AppText color="muted">{t('projects.pdfAttached')}</AppText>
        </View>
      ) : null}
      <AppButton
        title={isPdf ? t('projects.openPdf') : t('projects.openFile')}
        onPress={() => {
          void Linking.openURL(contractFile.uri);
        }}
        variant="secondary"
        fullWidth={false}
      />
    </View>
  );
}

async function pickContractFile() {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: ['image/*', 'application/pdf'],
  });

  if (result.canceled) {
    return undefined;
  }

  const asset = result.assets[0];

  return {
    uri: asset.uri,
    name: asset.name,
    mimeType: asset.mimeType ?? 'application/octet-stream',
  } satisfies ContractFile;
}

const ProjectForm = forwardRef<ProjectFormHandle, ProjectFormProps>(function ProjectForm(
  { title, submitLabel, initialValues, onSubmit, onCancel, embedded = false, onDirtyChange },
  ref,
) {
  const { locale, t } = useAppContext();
  const theme = useAppTheme();
  const [projectKind, setProjectKind] = useState(initialValues.projectKind);
  const [name, setName] = useState(initialValues.name);
  const [hourlyRate, setHourlyRate] = useState(initialValues.hourlyRate);
  const [currency, setCurrency] = useState<CurrencyCode>(initialValues.currency);
  const [contractType, setContractType] = useState<ContractType>(initialValues.contractType);
  const [startDate, setStartDate] = useState(initialValues.startDate);
  const [selectedColor, setSelectedColor] = useState<ProjectColor | null>(initialValues.color ?? null);
  const [isColorSheetOpen, setColorSheetOpen] = useState(false);
  const [paymentRuleValues, setPaymentRuleValues] = useState<PaymentRuleFormValues>(
    toPaymentRuleFormValues(initialValues.paymentRule, initialValues.startDate),
  );
  const [isEstimationOpen, setIsEstimationOpen] = useState(Boolean(initialValues.weeklyEstimation));
  const [weeklyEstimation, setWeeklyEstimation] = useState<Record<WeekdayEstimationKey, string>>(toWeeklyEstimationState(initialValues.weeklyEstimation));
  const [contractFile, setContractFile] = useState<ContractFile | undefined>(initialValues.contractFile);
  const [debtValues, setDebtValues] = useState(initialValues.debt);
  const initialDraft = getProjectFormDraft(initialValues);

  useEffect(() => {
    setProjectKind(initialValues.projectKind);
    setName(initialValues.name);
    setHourlyRate(initialValues.hourlyRate);
    setCurrency(initialValues.currency);
    setContractType(initialValues.contractType);
    setStartDate(initialValues.startDate);
    setSelectedColor(initialValues.color ?? null);
    setColorSheetOpen(false);
    setPaymentRuleValues(toPaymentRuleFormValues(initialValues.paymentRule, initialValues.startDate));
    setIsEstimationOpen(Boolean(initialValues.weeklyEstimation));
    setWeeklyEstimation(toWeeklyEstimationState(initialValues.weeklyEstimation));
    setContractFile(initialValues.contractFile);
    setDebtValues(initialValues.debt);
  }, [
    initialValues.color,
    initialValues.contractFile,
    initialValues.contractType,
    initialValues.currency,
    initialValues.hourlyRate,
    initialValues.name,
    initialValues.paymentRule,
    initialValues.projectKind,
    initialValues.startDate,
    initialValues.weeklyEstimation,
    initialValues.debt,
  ]);

  const parsedRate = parseDecimalInput(hourlyRate);
  const parsedWeeklyEstimation = WEEKDAY_FIELDS.reduce<WeeklyEstimation>((result, field) => {
    const parsedValue = parseDecimalInput(weeklyEstimation[field.key]);

    return {
      ...result,
      [field.key]: parsedValue === null || parsedValue < 0 ? 0 : parsedValue,
    };
  }, EMPTY_WEEKLY_ESTIMATION);
  const hasConfiguredEstimation = Object.values(parsedWeeklyEstimation).some((value) => value > 0);
  const paymentRule = buildPaymentRule(paymentRuleValues);
  const debtInput = useMemo(
    () => buildDebtInput(name, currency, startDate, selectedColor, debtValues),
    [currency, debtValues, name, selectedColor, startDate],
  );
  const debtValidationError = validateDebtProject(debtInput);
  const canSubmit =
    projectKind === 'income'
      ? Boolean(name.trim()) && parsedRate !== null && parsedRate > 0 && Boolean(startDate) && Boolean(paymentRule)
      : debtValidationError === null;
  const selectedColorOption = PROJECT_COLOR_PRESETS.find((option) => option.value === selectedColor);
  const currentDraft = useMemo(
    () => ({
      projectKind,
      name,
      hourlyRate,
      currency,
      contractType,
      startDate,
      color: selectedColor,
      paymentRuleValues,
      isEstimationOpen,
      weeklyEstimation,
      contractFile: contractFile ?? null,
      debt: debtValues,
    }),
    [
      contractFile,
      contractType,
      currency,
      debtValues,
      hourlyRate,
      isEstimationOpen,
      name,
      paymentRuleValues,
      projectKind,
      selectedColor,
      startDate,
      weeklyEstimation,
    ],
  );
  const isDirty = useMemo(() => JSON.stringify(initialDraft) !== JSON.stringify(currentDraft), [currentDraft, initialDraft]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const submitForm = useCallback(() => {
    if (!canSubmit) {
      return false;
    }

    if (projectKind === 'debt') {
      onSubmit(debtInput);
      return true;
    }

    if (parsedRate === null) {
      return false;
    }

    const payload = {
      projectKind: 'income' as const,
      name,
      hourlyRate: parsedRate,
      currency,
      contractType,
      startDate,
      color: selectedColor,
      paymentRule,
      weeklyEstimation: hasConfiguredEstimation ? parsedWeeklyEstimation : undefined,
      contractFile,
    };

    onSubmit(payload);
    return true;
  }, [
    canSubmit,
    contractFile,
    contractType,
    currency,
    debtInput,
    hasConfiguredEstimation,
    name,
    onSubmit,
    parsedRate,
    parsedWeeklyEstimation,
    paymentRule,
    projectKind,
    selectedColor,
    startDate,
  ]);

  useImperativeHandle(
    ref,
    () => ({
      hasUnsavedChanges: () => isDirty,
      submit: submitForm,
    }),
    [isDirty, submitForm],
  );

  const colorField = (
    <View style={styles.fieldBlock}>
      <AppText variant="bodySmall" color="muted">
        {t('projects.color')}
      </AppText>
      <View style={styles.colorActions}>
        <Pressable
          onPress={() => setSelectedColor(null)}
          style={[
            styles.colorActionButton,
            {
              backgroundColor: theme.colors.surface,
              borderColor: selectedColor === null ? theme.colors.primary : theme.colors.border,
            },
          ]}
        >
          <AppText color={selectedColor === null ? 'primary' : 'text'} variant="bodySmall" weight="semibold">
            {t('projects.noColor')}
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => setColorSheetOpen(true)}
          style={[
            styles.colorActionButton,
            styles.chooseColorButton,
            {
              backgroundColor: theme.colors.surface,
              borderColor: selectedColor ? theme.colors.primary : theme.colors.border,
            },
          ]}
        >
          <View style={styles.chooseColorContent}>
            {selectedColor ? <View style={[styles.selectedColorSwatch, { backgroundColor: selectedColor }]} /> : null}
            <View style={styles.chooseColorText}>
              <AppText color={selectedColor ? 'primary' : 'text'} variant="bodySmall" weight="semibold">
                {selectedColor ? t('projects.chosenColor') : t('projects.chooseColor')}
              </AppText>
              {selectedColorOption ? (
                <AppText color="muted" variant="bodySmall">
                  {t(selectedColorOption.labelKey)}
                </AppText>
              ) : null}
            </View>
          </View>
        </Pressable>
      </View>
    </View>
  );

  return (
    <>
      <View
        style={[
          styles.formCard,
          embedded
            ? styles.formCardEmbedded
            : {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
              },
        ]}
      >
        {title ? (
          <AppText variant="title" weight="bold">
            {title}
          </AppText>
        ) : null}

        <ChoiceSelector label={t('projects.projectType')} value={projectKind} options={PROJECT_KINDS} onChange={setProjectKind} />
        <AppInput onChangeText={setName} placeholder={t('projects.projectName')} value={name} />
        {projectKind === 'debt' ? colorField : null}
        {projectKind === 'income' ? (
          <>
            <AppInput
              keyboardType="decimal-pad"
              onChangeText={setHourlyRate}
              placeholder={t('projects.hourlyRatePlaceholder', { currency })}
              value={hourlyRate}
            />
            {parsedRate ? (
              <AppText color="muted" variant="bodySmall">
                {t('projects.ratePreview', { value: formatCurrency(parsedRate, locale, currency) })}
              </AppText>
            ) : null}
            <View style={styles.fieldBlock}>
              <AppText variant="bodySmall" color="muted">
                {t('projects.currency')}
              </AppText>
              <View style={styles.typeList}>
                {CURRENCIES.map((option) => {
                  const isSelected = option === currency;

                  return (
                    <Pressable
                      key={option}
                      onPress={() => setCurrency(option)}
                      style={[
                        styles.typeChip,
                        {
                          backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceMuted,
                          borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                        },
                      ]}
                    >
                      <AppText color={isSelected ? 'inverse' : 'text'} variant="bodySmall" weight="semibold">
                        {option}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <DateField label={t('projects.startDate')} onChange={setStartDate} value={startDate} />
            {colorField}

            <View
              style={[
                styles.accordionCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View style={styles.fieldBlock}>
                <AppText weight="semibold">{t('projects.paymentRuleTitle')}</AppText>
                <AppText color="muted" variant="bodySmall">
                  {t('projects.paymentRuleDescription')}
                </AppText>
              </View>

              <View style={styles.fieldBlock}>
                <AppText variant="bodySmall" color="muted">
                  {t('projects.paymentType')}
                </AppText>
                <View style={styles.typeList}>
                  {PAYMENT_TYPES.map((option) => {
                    const isSelected = option === paymentRuleValues.paymentType;

                    return (
                      <Pressable
                        key={option}
                        onPress={() => {
                          setPaymentRuleValues((currentValue) => ({
                            ...currentValue,
                            paymentType: option,
                          }));
                        }}
                        style={[
                          styles.typeChip,
                          {
                            backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceMuted,
                            borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                          },
                        ]}
                      >
                        <AppText color={isSelected ? 'inverse' : 'text'} variant="bodySmall" weight="semibold">
                          {t(`projects.${option}`)}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {paymentRuleValues.paymentType === 'one_time' ? (
                <DateField
                  label={t('projects.paymentDate')}
                  onChange={(value) => {
                    setPaymentRuleValues((currentValue) => ({
                      ...currentValue,
                      paymentDate: value,
                    }));
                  }}
                  value={paymentRuleValues.paymentDate}
                />
              ) : null}

              {paymentRuleValues.paymentType === 'monthly_fixed_day' ? (
                <View style={styles.fieldBlock}>
                  <AppText variant="bodySmall" color="muted">
                    {t('projects.paymentDayOfMonth')}
                  </AppText>
                  <AppInput
                    keyboardType="number-pad"
                    onChangeText={(value) => {
                      setPaymentRuleValues((currentValue) => ({
                        ...currentValue,
                        paymentDayOfMonth: value,
                      }));
                    }}
                    placeholder="30"
                    value={paymentRuleValues.paymentDayOfMonth}
                  />
                </View>
              ) : null}

              {paymentRuleValues.paymentType === 'weekly' ? (
                <View style={styles.fieldBlock}>
                  <AppText variant="bodySmall" color="muted">
                    {t('projects.paymentWeekday')}
                  </AppText>
                  <View style={styles.typeList}>
                    {PAYMENT_WEEKDAY_OPTIONS.map((option) => {
                      const isSelected = option.value === paymentRuleValues.paymentWeekday;

                      return (
                        <Pressable
                          key={option.value}
                          onPress={() => {
                            setPaymentRuleValues((currentValue) => ({
                              ...currentValue,
                              paymentWeekday: option.value,
                            }));
                          }}
                          style={[
                            styles.typeChip,
                            {
                              backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceMuted,
                              borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                            },
                          ]}
                        >
                          <AppText color={isSelected ? 'inverse' : 'text'} variant="bodySmall" weight="semibold">
                            {t(option.labelKey)}
                          </AppText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {paymentRuleValues.paymentType === 'biweekly' ? (
                <DateField
                  label={t('projects.paymentStartDate')}
                  onChange={(value) => {
                    setPaymentRuleValues((currentValue) => ({
                      ...currentValue,
                      paymentStartDate: value,
                    }));
                  }}
                  value={paymentRuleValues.paymentStartDate}
                />
              ) : null}
            </View>

            <View
              style={[
                styles.accordionCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Pressable onPress={() => setIsEstimationOpen((currentValue) => !currentValue)} style={styles.accordionToggle}>
                <View style={styles.accordionText}>
                  <AppText weight="semibold">{t('projects.weeklyEstimationTitle')}</AppText>
                  <AppText color="muted" variant="bodySmall">
                    {t('projects.weeklyEstimationDescription')}
                  </AppText>
                </View>
                <AppText color="primary" weight="semibold">
                  {isEstimationOpen ? t('common.close') : t('common.edit')}
                </AppText>
              </Pressable>

              {isEstimationOpen ? (
                <View style={styles.estimationGrid}>
                  {WEEKDAY_FIELDS.map((field) => (
                    <View key={field.key} style={styles.estimationField}>
                      <AppText variant="bodySmall" color="muted">
                        {t(field.labelKey)}
                      </AppText>
                      <AppInput
                        keyboardType="decimal-pad"
                        onChangeText={(value) => {
                          setWeeklyEstimation((currentValue) => ({
                            ...currentValue,
                            [field.key]: value,
                          }));
                        }}
                        placeholder="0"
                        value={weeklyEstimation[field.key]}
                      />
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={styles.fieldBlock}>
              <AppText variant="bodySmall" color="muted">
                {t('projects.contractType')}
              </AppText>
              <ContractTypeSelector value={contractType} onChange={setContractType} />
            </View>

            <View style={styles.fieldBlock}>
              <AppText variant="bodySmall" color="muted">
                {t('projects.contractFile')}
              </AppText>
              <AppButton
                title={contractFile ? t('projects.replaceFile') : t('projects.uploadContract')}
                onPress={async () => {
                  const file = await pickContractFile();

                  if (file) {
                    setContractFile(file);
                  }
                }}
                variant="secondary"
                fullWidth={false}
              />
              <ContractPreview contractFile={contractFile} />
            </View>
          </>
        ) : (
          <>
            <AppText weight="semibold">{t('projects.debtGeneral')}</AppText>
            <ChoiceSelector
              label={t('projects.debtType')}
              value={debtValues.debtType}
              options={DEBT_TYPES}
              onChange={(debtType) => setDebtValues((current) => ({ ...current, debtType }))}
            />
            <ChoiceSelector
              label={t('projects.creditorType')}
              value={debtValues.creditorType}
              options={CREDITOR_TYPES}
              onChange={(creditorType) => setDebtValues((current) => ({ ...current, creditorType }))}
            />
            <View style={styles.fieldBlock}>
              <AppText variant="bodySmall" color="muted">
                {t('projects.creditorName')}
              </AppText>
              <AppInput value={debtValues.creditorName} onChangeText={(creditorName) => setDebtValues((current) => ({ ...current, creditorName }))} />
            </View>

            <AppText weight="semibold">{t('projects.debtAmount')}</AppText>
            <View style={styles.fieldBlock}>
              <AppText variant="bodySmall" color="muted">
                {t('projects.currency')}
              </AppText>
              <View style={styles.typeList}>
                {CURRENCIES.map((option) => {
                  const isSelected = option === currency;

                  return (
                    <Pressable
                      key={option}
                      onPress={() => setCurrency(option)}
                      style={[
                        styles.typeChip,
                        {
                          backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceMuted,
                          borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                        },
                      ]}
                    >
                      <AppText color={isSelected ? 'inverse' : 'text'} variant="bodySmall" weight="semibold">
                        {option}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={styles.estimationGrid}>
              <View style={styles.estimationField}>
                <AppText variant="bodySmall" color="muted">
                  {t('projects.principalAmount')}
                </AppText>
                <AppInput
                  keyboardType="decimal-pad"
                  value={debtValues.principalAmount}
                  onChangeText={(principalAmount) => setDebtValues((current) => ({ ...current, principalAmount }))}
                />
              </View>
              <View style={styles.estimationField}>
                <AppText variant="bodySmall" color="muted">
                  {t('projects.finalAmount')}
                </AppText>
                <AppInput
                  keyboardType="decimal-pad"
                  value={debtValues.finalAmount}
                  onChangeText={(finalAmount) => setDebtValues((current) => ({ ...current, finalAmount }))}
                />
              </View>
            </View>
            <View style={styles.fieldBlock}>
              <AppText variant="bodySmall" color="muted">
                {t('projects.interestRate')}
              </AppText>
              <AppInput
                keyboardType="decimal-pad"
                placeholder={t('projects.optional')}
                value={debtValues.interestRate}
                onChangeText={(interestRate) => setDebtValues((current) => ({ ...current, interestRate }))}
              />
            </View>

            <AppText weight="semibold">{t('projects.paymentPlan')}</AppText>
            <ChoiceSelector
              label={t('projects.paymentFrequency')}
              value={debtValues.paymentFrequency}
              options={PAYMENT_FREQUENCIES}
              onChange={(paymentFrequency) => setDebtValues((current) => ({ ...current, paymentFrequency }))}
            />
            <View style={styles.fieldBlock}>
              <AppText variant="bodySmall" color="muted">
                {t('projects.manualPayment')}
              </AppText>
              <Switch value={debtValues.manualPayment} onValueChange={(manualPayment) => setDebtValues((current) => ({ ...current, manualPayment }))} />
            </View>
            <View style={styles.estimationGrid}>
              <View style={styles.estimationField}>
                <AppText variant="bodySmall" color="muted">
                  {t('projects.installmentCount')}
                </AppText>
                <AppInput
                  keyboardType="number-pad"
                  placeholder={t('projects.optional')}
                  value={debtValues.installmentCount}
                  onChangeText={(installmentCount) => setDebtValues((current) => ({ ...current, installmentCount }))}
                />
              </View>
              <View style={styles.estimationField}>
                <AppText variant="bodySmall" color="muted">
                  {t('projects.installmentAmount')}
                </AppText>
                <AppInput
                  keyboardType="decimal-pad"
                  placeholder={t('projects.optional')}
                  value={debtValues.installmentAmount}
                  onChangeText={(installmentAmount) => setDebtValues((current) => ({ ...current, installmentAmount }))}
                />
              </View>
            </View>
            <DateField label={t('projects.startDate')} onChange={setStartDate} value={startDate} />
            <DateField label={t('projects.dueDate')} value={debtValues.endDate} onChange={(endDate) => setDebtValues((current) => ({ ...current, endDate }))} />

            <AppText weight="semibold">{t('projects.additional')}</AppText>
            <ChoiceSelector
              label={t('projects.status')}
              value={debtValues.status}
              options={DEBT_STATUSES}
              onChange={(status) => setDebtValues((current) => ({ ...current, status }))}
            />
            <View style={styles.fieldBlock}>
              <AppText variant="bodySmall" color="muted">
                {t('projects.notes')}
              </AppText>
              <AppInput
                multiline
                numberOfLines={4}
                placeholder={t('projects.optional')}
                style={styles.notesInput}
                textAlignVertical="top"
                value={debtValues.notes}
                onChangeText={(notes) => setDebtValues((current) => ({ ...current, notes }))}
              />
            </View>
            {debtValidationError ? (
              <AppText color="danger" variant="bodySmall">
                {t(`projects.debtValidation.${debtValidationError}`)}
              </AppText>
            ) : null}
          </>
        )}

        <View style={styles.formActions}>
          {onCancel ? <AppButton title={t('common.cancel')} onPress={onCancel} variant="secondary" fullWidth={false} /> : null}
          <AppButton title={submitLabel} onPress={submitForm} disabled={!canSubmit} fullWidth={false} />
        </View>
      </View>

      <Modal animationType="fade" transparent visible={isColorSheetOpen} onRequestClose={() => setColorSheetOpen(false)}>
        <View style={styles.colorSheetOverlay}>
          <Pressable style={styles.colorSheetBackdrop} onPress={() => setColorSheetOpen(false)} />
          <View
            style={[
              styles.colorSheetCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.colorSheetHandleWrapper}>
              <View
                style={[
                  styles.colorSheetHandle,
                  {
                    backgroundColor: theme.colors.borderStrong,
                  },
                ]}
              />
            </View>
            <AppText variant="title" weight="bold">
              {t('projects.colorSheetTitle')}
            </AppText>
            <AppText color="muted" variant="bodySmall">
              {t('projects.colorSheetDescription')}
            </AppText>
            <View style={styles.colorSheetGrid}>
              {PROJECT_COLOR_PRESETS.map((option) => {
                const isSelected = selectedColor === option.value;

                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      setSelectedColor(option.value);
                      setColorSheetOpen(false);
                    }}
                    style={[
                      styles.colorOptionCard,
                      {
                        backgroundColor: theme.colors.surfaceMuted,
                        borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.colorOptionSwatch,
                        {
                          backgroundColor: option.value,
                        },
                      ]}
                    />
                    <AppText color={isSelected ? 'primary' : 'text'} variant="bodySmall" weight="semibold">
                      {t(option.labelKey)}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
            <AppButton title={t('common.close')} onPress={() => setColorSheetOpen(false)} variant="secondary" />
          </View>
        </View>
      </Modal>
    </>
  );
});

export function ProjectsManager({ projects, onCreateProject, onUpdateProject, onDeleteProject, defaultOpen = false, showToggle = true }: ProjectsManagerProps) {
  const { locale, showToast, t } = useAppContext();
  const theme = useAppTheme();
  const isFlatLayout = !showToggle;
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectPendingDelete, setProjectPendingDelete] = useState<Project | null>(null);
  const [isUnsavedChangesModalOpen, setUnsavedChangesModalOpen] = useState(false);
  const createFormRef = useRef<ProjectFormHandle>(null);
  const editFormRef = useRef<ProjectFormHandle>(null);
  const unsavedSaveActionRef = useRef<(() => boolean) | null>(null);
  const unsavedDiscardActionRef = useRef<(() => void) | null>(null);
  const editingProject = useMemo(() => projects.find((project) => project.id === editingProjectId), [editingProjectId, projects]);
  const createProjectInitialValues = useMemo<ProjectFormValues>(() => {
    const today = toDateKey(new Date());

    return {
      projectKind: 'income',
      name: '',
      hourlyRate: '',
      currency: 'EUR',
      contractType: 'hourly',
      startDate: today,
      color: null,
      paymentRule: {
        type: 'one_time',
        paymentDate: today,
      },
      weeklyEstimation: undefined,
      debt: createEmptyDebtValues(today),
    };
  }, []);
  const editingProjectInitialValues = useMemo<ProjectFormValues | null>(
    () =>
      editingProject?.projectKind === 'income'
        ? {
            projectKind: 'income',
            name: editingProject.name,
            hourlyRate: String(editingProject.hourlyRate),
            currency: editingProject.currency,
            contractType: editingProject.contractType,
            startDate: editingProject.startDate,
            color: editingProject.color,
            paymentRule: editingProject.paymentRule,
            weeklyEstimation: editingProject.weeklyEstimation,
            contractFile: editingProject.contractFile,
            debt: createEmptyDebtValues(editingProject.startDate),
          }
        : editingProject
          ? {
              projectKind: 'debt',
              name: editingProject.name,
              hourlyRate: '',
              currency: editingProject.currency,
              contractType: 'hourly',
              startDate: editingProject.startDate,
              color: editingProject.color,
              paymentRule: undefined,
              weeklyEstimation: undefined,
              contractFile: undefined,
              debt: {
                debtType: editingProject.debtType,
                creditorType: editingProject.creditorType,
                creditorName: editingProject.creditorName,
                principalAmount: String(editingProject.principalAmount),
                finalAmount: String(editingProject.finalAmount),
                interestRate: editingProject.interestRate === undefined ? '' : String(editingProject.interestRate),
                paymentFrequency: editingProject.paymentFrequency,
                manualPayment: editingProject.manualPayment,
                installmentCount: editingProject.installmentCount === undefined ? '' : String(editingProject.installmentCount),
                installmentAmount: editingProject.installmentAmount === undefined ? '' : String(editingProject.installmentAmount),
                endDate: editingProject.endDate,
                notes: editingProject.notes ?? '',
                status: editingProject.status,
              },
            }
          : null,
    [editingProject],
  );

  useEffect(() => {
    setCreateOpen(projects.length === 0);
  }, [projects.length]);

  const openUnsavedChangesModal = useCallback((saveAction: () => boolean, discardAction: () => void) => {
    unsavedSaveActionRef.current = saveAction;
    unsavedDiscardActionRef.current = discardAction;
    setUnsavedChangesModalOpen(true);
  }, []);

  const closeUnsavedChangesModal = useCallback(() => {
    setUnsavedChangesModalOpen(false);
    unsavedSaveActionRef.current = null;
    unsavedDiscardActionRef.current = null;
  }, []);

  const confirmSaveChanges = useCallback(() => {
    setUnsavedChangesModalOpen(false);

    const didSave = unsavedSaveActionRef.current?.() ?? false;

    unsavedSaveActionRef.current = null;
    unsavedDiscardActionRef.current = null;

    if (!didSave) {
      showToast({
        type: 'warning',
        title: t('feedback.unsavedChangesTitle'),
        message: t('feedback.completeFieldsBeforeSaving'),
      });
    }
  }, [showToast, t]);

  const confirmDiscardChanges = useCallback(() => {
    setUnsavedChangesModalOpen(false);
    unsavedDiscardActionRef.current?.();
    unsavedSaveActionRef.current = null;
    unsavedDiscardActionRef.current = null;
  }, []);

  const requestCreateAccordionToggle = useCallback(() => {
    if (!isCreateOpen) {
      setCreateOpen(true);
      return;
    }

    if (createFormRef.current?.hasUnsavedChanges()) {
      openUnsavedChangesModal(
        () => createFormRef.current?.submit() ?? false,
        () => setCreateOpen(false),
      );
      return;
    }

    setCreateOpen(false);
  }, [isCreateOpen, openUnsavedChangesModal]);

  const requestEditingProjectChange = useCallback(
    (nextProjectId: string | null) => {
      if (editFormRef.current?.hasUnsavedChanges()) {
        openUnsavedChangesModal(
          () => {
            const didSave = editFormRef.current?.submit() ?? false;

            if (didSave) {
              setEditingProjectId(nextProjectId);
            }

            return didSave;
          },
          () => setEditingProjectId(nextProjectId),
        );
        return;
      }

      setEditingProjectId(nextProjectId);
    },
    [openUnsavedChangesModal],
  );

  const requestSectionToggle = useCallback(() => {
    if (!isOpen) {
      setIsOpen(true);
      return;
    }

    if (editFormRef.current?.hasUnsavedChanges()) {
      openUnsavedChangesModal(
        () => {
          const didSave = editFormRef.current?.submit() ?? false;

          if (didSave) {
            setIsOpen(false);
          }

          return didSave;
        },
        () => setIsOpen(false),
      );
      return;
    }

    if (createFormRef.current?.hasUnsavedChanges()) {
      openUnsavedChangesModal(
        () => {
          const didSave = createFormRef.current?.submit() ?? false;

          if (didSave) {
            setIsOpen(false);
          }

          return didSave;
        },
        () => setIsOpen(false),
      );
      return;
    }

    setIsOpen(false);
  }, [isOpen, openUnsavedChangesModal]);

  return (
    <View style={styles.wrapper}>
      {showToggle ? (
        <AppButton title={isOpen ? t('projects.hide') : t('projects.manage')} onPress={requestSectionToggle} variant="secondary" fullWidth={false} />
      ) : null}

      {isOpen ? (
        <View
          style={[
            styles.section,
            isFlatLayout
              ? styles.sectionFlat
              : {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
          ]}
        >
          <AppText variant="title" weight="bold">
            {t('projects.title')}
          </AppText>

          {projects.length === 0 ? (
            <AppText color="muted">{t('projects.noProjects')}</AppText>
          ) : (
            projects.map((project) => {
              const isEditing = project.id === editingProjectId;

              return (
                <View
                  key={project.id}
                  style={[
                    styles.projectCard,
                    {
                      backgroundColor: theme.colors.surfaceMuted,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <View style={styles.projectCardHeader}>
                    <View style={styles.projectMeta}>
                      <View style={styles.projectTitleRow}>
                        <AppText weight="bold">{project.name}</AppText>
                        <View
                          style={[
                            styles.kindBadge,
                            {
                              backgroundColor: project.projectKind === 'debt' ? theme.colors.warningSoft : theme.colors.primarySoft,
                            },
                          ]}
                        >
                          <AppText
                            variant="label"
                            weight="bold"
                            style={{
                              color: project.projectKind === 'debt' ? theme.colors.warning : theme.colors.primary,
                            }}
                          >
                            {t(`projects.${project.projectKind}`)}
                          </AppText>
                        </View>
                      </View>
                      <AppText color="muted" variant="bodySmall">
                        {project.projectKind === 'income'
                          ? `${formatCurrency(project.hourlyRate, locale, project.currency)}/h | ${project.currency} | ${t(`projects.${project.contractType}`)} | ${t(
                              'projects.started',
                              {
                                date: formatDate(fromDateKey(project.startDate), locale),
                              },
                            )}`
                          : `${project.creditorName} | ${formatCurrency(project.finalAmount, locale, project.currency)} | ${t(`projects.${project.status}`)}`}
                      </AppText>
                      {project.projectKind === 'income' && hasWeeklyEstimation(project) ? (
                        <AppText color="muted" variant="bodySmall">
                          {t('projects.weeklyEstimationConfigured')}
                        </AppText>
                      ) : null}
                    </View>
                    <View style={styles.projectButtons}>
                      <AppButton
                        title={isEditing ? t('common.close') : t('common.edit')}
                        onPress={() => requestEditingProjectChange(isEditing ? null : project.id)}
                        variant="secondary"
                        fullWidth={false}
                      />
                      <AppButton title={t('common.delete')} onPress={() => setProjectPendingDelete(project)} variant="ghost" fullWidth={false} />
                    </View>
                  </View>

                  {project.projectKind === 'income' ? <ContractPreview contractFile={project.contractFile} /> : null}

                  {isEditing && editingProject && editingProjectInitialValues ? (
                    <ProjectForm
                      ref={editFormRef}
                      key={editingProject.id}
                      title={t('projects.editTitle')}
                      submitLabel={t('projects.updateInformation')}
                      initialValues={editingProjectInitialValues}
                      onSubmit={(values) => {
                        onUpdateProject(project.id, values as UpdateProjectInput);
                        showToast({
                          type: 'info',
                          title: t('feedback.successTitle'),
                          message: t('feedback.projectUpdated', { name: project.name }),
                        });
                        setEditingProjectId(null);
                      }}
                      onCancel={() => requestEditingProjectChange(null)}
                    />
                  ) : null}
                </View>
              );
            })
          )}

          <View
            style={[
              styles.accordionCard,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Pressable onPress={requestCreateAccordionToggle} style={styles.accordionToggle}>
              <View style={styles.accordionText}>
                <AppText weight="bold" style={styles.accordionTitle}>
                  {t('projects.createTitle')}
                </AppText>
                <AppText color="muted" variant="bodySmall">
                  {t('projects.createProjectDescription')}
                </AppText>
              </View>
              <AppText color="primary" weight="semibold">
                {isCreateOpen ? t('common.close') : t('common.create')}
              </AppText>
            </Pressable>

            {isCreateOpen ? (
              <ProjectForm
                ref={createFormRef}
                title={''}
                submitLabel={t('projects.saveProject')}
                embedded
                initialValues={createProjectInitialValues}
                onSubmit={(values) => {
                  const project = onCreateProject(values as CreateProjectInput);

                  if (project) {
                    showToast({
                      type: 'success',
                      title: t('feedback.successTitle'),
                      message: t('feedback.projectCreated', { name: project.name }),
                    });
                    setEditingProjectId(null);
                    setCreateOpen(false);
                  }
                }}
              />
            ) : null}
          </View>
        </View>
      ) : null}

      <Modal animationType="fade" transparent visible={Boolean(projectPendingDelete)} onRequestClose={() => setProjectPendingDelete(null)}>
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
            <AppText variant="title" weight="bold">
              {t('projects.deleteTitle')}
            </AppText>
            <AppText color="muted">
              {projectPendingDelete
                ? t(projectPendingDelete.projectKind === 'debt' ? 'projects.deleteDebtBody' : 'projects.deleteBody', {
                    name: projectPendingDelete.name,
                  })
                : t('projects.deleteFallback')}
            </AppText>
            <View style={styles.modalActions}>
              <AppButton title={t('common.cancel')} onPress={() => setProjectPendingDelete(null)} variant="secondary" fullWidth={false} />
              <AppButton
                title={t('common.delete')}
                onPress={() => {
                  if (projectPendingDelete) {
                    if (editingProjectId === projectPendingDelete.id) {
                      setEditingProjectId(null);
                    }

                    onDeleteProject(projectPendingDelete.id);
                    showToast({
                      type: 'danger',
                      title: t('feedback.successTitle'),
                      message: t('feedback.projectDeleted', { name: projectPendingDelete.name }),
                    });
                    setProjectPendingDelete(null);
                  }
                }}
                fullWidth={false}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent visible={isUnsavedChangesModalOpen} onRequestClose={closeUnsavedChangesModal}>
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
            <AppText variant="title" weight="bold">
              {t('feedback.unsavedChangesTitle')}
            </AppText>
            <AppText color="muted">{t('feedback.unsavedChangesBody')}</AppText>
            <View style={styles.modalActions}>
              <AppButton title={t('common.cancel')} onPress={closeUnsavedChangesModal} variant="secondary" fullWidth={false} />
              <AppButton title={t('common.discard')} onPress={confirmDiscardChanges} variant="ghost" fullWidth={false} />
              <AppButton title={t('common.saveChanges')} onPress={confirmSaveChanges} fullWidth={false} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 12,
  },
  section: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 16,
    padding: 20,
  },
  sectionFlat: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    gap: 16,
    padding: 0,
  },
  formCard: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  formCardEmbedded: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
    padding: 0,
  },
  accordionCard: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  accordionToggle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  accordionText: {
    flex: 1,
    gap: 4,
  },
  accordionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  estimationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  estimationField: {
    gap: 6,
    minWidth: '47%',
  },
  fieldBlock: {
    gap: 8,
  },
  typeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorActions: {
    flexDirection: 'row',
    gap: 10,
  },
  typeChip: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  colorActionButton: {
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chooseColorButton: {
    flex: 1,
  },
  chooseColorContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  chooseColorText: {
    flex: 1,
    gap: 2,
  },
  selectedColorSwatch: {
    borderRadius: 999,
    height: 18,
    width: 18,
  },
  previewBlock: {
    gap: 8,
  },
  previewImage: {
    borderRadius: 14,
    height: 180,
    width: '100%',
  },
  pdfPreview: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 120,
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
  },
  projectCard: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  projectCardHeader: {
    gap: 12,
  },
  projectMeta: {
    gap: 4,
  },
  projectTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  kindBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  notesInput: {
    minHeight: 96,
  },
  projectButtons: {
    flexDirection: 'row',
    gap: 10,
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
  colorSheetOverlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  colorSheetBackdrop: {
    flex: 1,
  },
  colorSheetCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 20,
  },
  colorSheetHandleWrapper: {
    alignItems: 'center',
    marginBottom: 4,
  },
  colorSheetHandle: {
    borderRadius: 999,
    height: 5,
    width: 44,
  },
  colorSheetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorOptionCard: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    minWidth: '47%',
    padding: 14,
  },
  colorOptionSwatch: {
    borderRadius: 999,
    height: 28,
    width: 28,
  },
});
