import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
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

const POP_EASING = Easing.out(Easing.quad);

function TabButton({
  item,
  isActive,
  onPress,
}: {
  item: TabItem;
  isActive: boolean;
  onPress: (key: string) => void;
}) {
  const active = useThemeColor({}, 'tabIconSelected');
  const inactive = useThemeColor({}, 'tabIconDefault');

  // press = held-down scale; pop = one-shot bounce when the tab activates.
  const press = useSharedValue(1);
  const pop = useSharedValue(1);
  const pill = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    if (isActive) {
      pop.value = withSequence(
        withTiming(1.22, { duration: 110, easing: POP_EASING }),
        withSpring(1, { damping: 11, stiffness: 240 }),
      );
      pill.value = withTiming(1, { duration: 180, easing: POP_EASING });
    } else {
      pill.value = withTiming(0, { duration: 150, easing: POP_EASING });
    }
  }, [isActive, pop, pill]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value * pop.value }],
  }));
  const pillStyle = useAnimatedStyle(() => ({
    opacity: pill.value,
    transform: [{ scale: 0.85 + pill.value * 0.15 }],
  }));

  return (
    <Pressable
      onPress={() => onPress(item.key)}
      onPressIn={() => {
        press.value = withSpring(0.88, { damping: 15, stiffness: 420 });
      }}
      onPressOut={() => {
        press.value = withSpring(1, { damping: 14, stiffness: 300 });
      }}
      style={s.tab}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={item.label}>
      <Animated.View style={animatedStyle}>
        <MaterialIcons name={item.icon} size={24} color={isActive ? active : inactive} />
      </Animated.View>
      <View style={s.labelWrap}>
        <Animated.View
          style={[s.labelPill, { backgroundColor: active + '18' }, pillStyle]}
        />
        <Text style={[s.label, { color: isActive ? active : inactive }]}>{item.label}</Text>
      </View>
    </Pressable>
  );
}

function CenterFab({ item, onPress }: { item: TabItem; onPress: (key: string) => void }) {
  const primary = useThemeColor({}, 'primary');
  const onPrimary = useThemeColor({}, 'onPrimary');
  const press = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
  }));

  return (
    <Pressable
      onPress={() => onPress(item.key)}
      onPressIn={() => {
        press.value = withSpring(0.9, { damping: 15, stiffness: 420 });
      }}
      onPressOut={() => {
        press.value = withSpring(1, { damping: 12, stiffness: 280 });
      }}
      style={[s.fab, { backgroundColor: primary }]}
      accessibilityRole="button"
      accessibilityLabel={item.label}>
      <Animated.View style={animatedStyle}>
        <MaterialIcons name={item.icon} size={28} color={onPrimary} />
      </Animated.View>
    </Pressable>
  );
}

export function CustomTabBar({ items, activeKey, onPress }: CustomTabBarProps) {
  const surface = useThemeColor({}, 'surface');
  const outline = useThemeColor({}, 'outlineVariant');
  const insets = useSafeAreaInsets();
  const mid = Math.floor(items.length / 2);

  return (
    <View style={[s.bar, { backgroundColor: surface, borderTopColor: outline, paddingBottom: insets.bottom }]}>
      {items.map((item, i) =>
        i === mid ? (
          <CenterFab key={item.key} item={item} onPress={onPress} />
        ) : (
          <TabButton
            key={item.key}
            item={item}
            isActive={item.key === activeKey}
            onPress={onPress}
          />
        ),
      )}
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
  labelWrap: {
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  labelPill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.sm,
  },
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
