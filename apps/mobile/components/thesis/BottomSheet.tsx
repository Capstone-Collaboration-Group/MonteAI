// apps/mobile/components/thesis/BottomSheet.tsx
//
// Lightweight bottom-sheet modal used by the Sections and Annotations
// dropdowns. No third-party sheet library — just a slide-up modal with a
// tappable backdrop.

import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { FontSize, Radius, Spacing } from '@/constants/theme';

interface BottomSheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  bodyStyle?: ViewStyle;
}

export function BottomSheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
  bodyStyle,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const surface = useThemeColor({}, 'surface');
  const heading = useThemeColor({}, 'onSurface');
  const body = useThemeColor({}, 'onSurfaceVariant');
  const outline = useThemeColor({}, 'outlineVariant');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View
        style={[
          s.sheet,
          { backgroundColor: surface, paddingBottom: insets.bottom + Spacing.lg },
          bodyStyle,
        ]}>
        <View style={[s.handle, { backgroundColor: outline }]} />
        <View style={s.header}>
          <View style={s.headerText}>
            <Text style={[s.title, { color: heading }]}>{title}</Text>
            {subtitle ? (
              <Text style={[s.subtitle, { color: body }]}>{subtitle}</Text>
            ) : null}
          </View>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
            <MaterialIcons name="close" size={22} color={body} />
          </Pressable>
        </View>
        {children}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    maxHeight: '72%',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: Spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: Radius.pill,
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  headerText: { flex: 1 },
  title: { fontSize: FontSize.lg, fontWeight: '700' },
  subtitle: { fontSize: FontSize.xs, marginTop: 2 },
});
