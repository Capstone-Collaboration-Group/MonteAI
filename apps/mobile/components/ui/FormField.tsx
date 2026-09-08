import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/use-theme-color';
import { FontSize, Spacing } from '@/constants/theme';

export interface FormFieldProps {
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}

export function FormField({ label, icon, error, hint, children }: FormFieldProps) {
  const heading = useThemeColor({}, 'onSurface');
  const danger = useThemeColor({}, 'error');
  return (
    <View style={s.field}>
      <View style={s.labelRow}>
        <MaterialIcons name={icon} size={16} color="#15803d" />
        <Text style={[s.label, { color: heading }]}>{label}</Text>
      </View>
      {children}
      {error ? <Text style={[s.error, { color: danger }]}>{error}</Text> : null}
      {hint && !error ? hint : null}
    </View>
  );
}

const s = StyleSheet.create({
  field: { gap: Spacing.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  label: { fontSize: FontSize.md, fontWeight: '600' },
  error: { fontSize: FontSize.xs },
});
