import { useState } from 'react';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAppContext } from '@/context';
import { useAppTheme } from '@/theme';
import { formatDate, fromDateKey, toDateKey } from '@/utils';

import { AppText } from '../atoms/AppText';

export type DateFieldProps = {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
};

export function DateField({ label, value, onChange, disabled = false }: DateFieldProps) {
  const { locale } = useAppContext();
  const theme = useAppTheme();
  const [showPicker, setShowPicker] = useState(false);
  const selectedDate = value ? fromDateKey(value) : new Date();

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    setShowPicker(false);

    if (event.type === 'dismissed' || !date) {
      return;
    }

    onChange?.(toDateKey(date));
  };

  return (
    <View style={styles.container}>
      <AppText variant="bodySmall" color="muted">
        {label}
      </AppText>
      <Pressable
        disabled={disabled}
        onPress={() => setShowPicker(true)}
        style={[
          styles.field,
          disabled ? styles.disabled : null,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <AppText>{formatDate(selectedDate, locale)}</AppText>
      </Pressable>

      {showPicker ? <DateTimePicker mode="date" value={selectedDate} onChange={handleChange} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  field: {
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  disabled: {
    borderWidth: 0,
    opacity: 0.7,
  },
});
