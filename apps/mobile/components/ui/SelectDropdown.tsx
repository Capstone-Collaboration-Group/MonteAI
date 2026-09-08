import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/use-theme-color';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { FormField, type FormFieldProps } from './FormField';

interface SelectDropdownProps extends Omit<FormFieldProps, 'children'> {
  value: string;
  placeholder: string;
  options: string[];
  onSelect: (value: string) => void;
}

export function SelectDropdown({
  value,
  placeholder,
  options,
  onSelect,
  ...fieldProps
}: SelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const surface = useThemeColor({}, 'surface');
  const heading = useThemeColor({}, 'onSurface');
  const outline = useThemeColor({}, 'outlineVariant');
  const borderColor = fieldProps.error ? '#ba1a1a' : outline;
  return (
    <FormField {...fieldProps}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={fieldProps.label}
        onPress={() => setOpen((p) => !p)}
        style={[s.trigger, { backgroundColor: surface, borderColor }]}>
        <Text style={[s.triggerText, { color: value ? heading : '#9ca3af' }]}>
          {value || placeholder}
        </Text>
        <MaterialIcons
          name={open ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
          size={22}
          color="#6b7280"
        />
      </Pressable>
      {open ? (
        <View style={[s.options, { backgroundColor: surface, borderColor: outline }]}>
          {options.map((option) => (
            <Pressable
              key={option}
              onPress={() => { onSelect(option); setOpen(false); }}
              style={({ pressed }) => [s.option, pressed && s.pressed]}>
              <Text style={[s.optionText, { color: heading, fontWeight: option === value ? '600' : '400' }]}>
                {option}
              </Text>
              {option === value ? <MaterialIcons name="check" size={18} color="#15803d" /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </FormField>
  );
}

const s = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  triggerText: { flex: 1, fontSize: FontSize.md },
  options: { borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 13,
  },
  optionText: { fontSize: FontSize.md },
  pressed: { opacity: 0.85 },
});
