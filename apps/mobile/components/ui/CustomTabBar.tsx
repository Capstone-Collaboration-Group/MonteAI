import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Spacing } from '@/constants/theme';

export interface TabItem {
  key: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
}

export interface CustomTabBarProps {
  items: readonly TabItem[];
  activeKey: string;
  onPress: (key: string) => void;
}

export function CustomTabBar({ items, activeKey, onPress }: CustomTabBarProps) {
  const surface = useThemeColor({}, 'surface');
  const primary = useThemeColor({}, 'primary');
  const onPrimary = useThemeColor({}, 'onPrimary');
  const inactive = useThemeColor({}, 'tabIconDefault');
  const active = useThemeColor({}, 'tabIconSelected');
  const outline = useThemeColor({}, 'outlineVariant');
  const insets = useSafeAreaInsets();
  const mid = Math.floor(items.length / 2);

  return (
    <View style={[s.bar, { backgroundColor: surface, borderTopColor: outline, paddingBottom: insets.bottom }]}>
      {items.map((item, i) => {
        const isCenter = i === mid;
        const isActive = item.key === activeKey;
        if (isCenter) {
          return (
            <Pressable
              key={item.key}
              onPress={() => onPress(item.key)}
              style={[s.fab, { backgroundColor: primary }]}
              accessibilityRole="button"
              accessibilityLabel={item.label}>
              <MaterialIcons name={item.icon} size={28} color={onPrimary} />
            </Pressable>
          );
        }
        return (
          <Pressable
            key={item.key}
            onPress={() => onPress(item.key)}
            style={s.tab}
            accessibilityRole="button"
            accessibilityLabel={item.label}>
            <MaterialIcons name={item.icon} size={24} color={isActive ? active : inactive} />
            <View style={[s.labelWrap, isActive && { backgroundColor: active + '18' }]}>
              <Text style={[s.label, { color: isActive ? active : inactive }]}>{item.label}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  tab: { alignItems: 'center', flex: 1, gap: 2 },
  labelWrap: { borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  label: { fontSize: 11, fontWeight: '500' },
  fab: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
});
