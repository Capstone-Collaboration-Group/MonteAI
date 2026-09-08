import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';
import { FontSize, Radius, Spacing } from '@/constants/theme';

export interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  accessibilityLabel,
}: PrimaryButtonProps) {
  const primary = useThemeColor({}, 'primary');
  const onPrimary = useThemeColor({}, 'onPrimary');
  const busy = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        s.button,
        { backgroundColor: primary, opacity: busy ? 0.7 : 1 },
        pressed && s.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={onPrimary} />
      ) : (
        <Text style={[s.label, { color: onPrimary }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingVertical: Spacing.lg,
    borderRadius: Radius.md,
    gap: Spacing.sm,
  },
  label: { fontSize: FontSize.lg, textAlign: 'center' },
  pressed: { opacity: 0.85 },
});
