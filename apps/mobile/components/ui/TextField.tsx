import React from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { FormField, type FormFieldProps } from './FormField';

interface TextFieldProps extends Omit<FormFieldProps, 'children'> {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  placeholderTextColor?: string;
  secureTextEntry?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  maxLength?: number;
}

export function TextField({
  value,
  onChangeText,
  placeholder,
  placeholderTextColor = '#9ca3af',
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
  autoComplete,
  maxLength,
  ...fieldProps
}: TextFieldProps) {
  const surface = useThemeColor({}, 'surface');
  const heading = useThemeColor({}, 'onSurface');
  const outline = useThemeColor({}, 'outlineVariant');
  const borderColor = fieldProps.error ? '#ba1a1a' : outline;
  return (
    <FormField {...fieldProps}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        maxLength={maxLength}
        style={[s.input, { backgroundColor: surface, borderColor, color: heading }]}
      />
    </FormField>
  );
}

const s = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    fontSize: FontSize.md,
  },
});
