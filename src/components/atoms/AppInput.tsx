import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { useAppTheme } from '@/theme';

export type AppInputProps = TextInputProps & {
  hasError?: boolean;
};

export function AppInput({ editable = true, hasError = false, style, ...props }: AppInputProps) {
  const theme = useAppTheme();

  return (
    <TextInput
      placeholderTextColor={theme.colors.muted}
      selectionColor={theme.colors.primary}
      style={[
        styles.input,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: hasError ? theme.colors.danger : theme.colors.border,
          color: theme.colors.text,
        },
        !editable ? styles.readonly : null,
        style,
      ]}
      editable={editable}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  readonly: {
    borderWidth: 0,
  },
});
