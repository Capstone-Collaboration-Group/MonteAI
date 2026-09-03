import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/use-theme-color';
import { FontSize, Spacing } from '@/constants/theme';

interface AppHeaderProps {
  title: string;
  leftIcon?: React.ComponentProps<typeof MaterialIcons>['name'];
  onLeftPress?: () => void;
  rightIcons?: {
    icon: React.ComponentProps<typeof MaterialIcons>['name'];
    onPress?: () => void;
  }[];
}

export function AppHeader({ title, leftIcon = 'menu', onLeftPress, rightIcons }: AppHeaderProps) {
  const primary = useThemeColor({}, 'primary');
  const onPrimary = useThemeColor({}, 'onPrimary');
  return (
    <View style={[s.bar, { backgroundColor: primary }]}>
      <View style={s.side}>
        {leftIcon ? (
          <View style={s.btn}>
            <MaterialIcons name={leftIcon} size={24} color={onPrimary} onPress={onLeftPress} />
          </View>
        ) : null}
      </View>
      <Text style={[s.title, { color: onPrimary }]}>{title}</Text>
      <View style={[s.side, s.sideRight]}>
        {rightIcons?.map((r, i) => (
          <View key={i} style={s.btn}>
            <MaterialIcons name={r.icon} size={22} color={onPrimary} onPress={r.onPress} />
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingTop: Spacing.xl,
  },
  side: { width: 80 },
  sideRight: { alignItems: 'flex-end' },
  btn: { padding: Spacing.xs },
  title: { flex: 1, textAlign: 'center', fontSize: FontSize.lg, fontWeight: '700' },
});
