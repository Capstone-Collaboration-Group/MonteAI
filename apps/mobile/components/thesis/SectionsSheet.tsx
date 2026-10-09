// apps/mobile/components/thesis/SectionsSheet.tsx
//
// "Sections" dropdown — the flattened PDF bookmark outline. Tapping an entry
// scrolls the continuous PDF to that page.

import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/use-theme-color';
import { FontSize, Spacing } from '@/constants/theme';
import { BottomSheet } from './BottomSheet';
import type { PdfOutlineItem } from './ThesisPdfViewer';

interface SectionsSheetProps {
  visible: boolean;
  items: PdfOutlineItem[];
  currentPage: number;
  onClose: () => void;
  onSelect: (item: PdfOutlineItem) => void;
}

export function SectionsSheet({
  visible,
  items,
  currentPage,
  onClose,
  onSelect,
}: SectionsSheetProps) {
  const heading = useThemeColor({}, 'onSurface');
  const body = useThemeColor({}, 'onSurfaceVariant');
  const primary = useThemeColor({}, 'primary');
  const surfaceLow = useThemeColor({}, 'surfaceContainerLow');
  const outline = useThemeColor({}, 'outlineVariant');

  // The active section is the last bookmark at or before the visible page.
  const activeId = useMemo(() => {
    let active: string | null = null;
    for (const item of items) {
      if (item.page <= currentPage) active = item.id;
      else break;
    }
    return active;
  }, [items, currentPage]);

  return (
    <BottomSheet
      visible={visible}
      title="Sections"
      subtitle={
        items.length > 0
          ? 'From the PDF table of contents'
          : 'This PDF has no bookmarks/table of contents'
      }
      onClose={onClose}>
      {items.length === 0 ? (
        <View style={s.empty}>
          <MaterialIcons name="toc" size={28} color={outline} />
          <Text style={[s.emptyText, { color: body }]}>
            No sections were detected in this document.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}>
          {items.map((item) => {
            const active = item.id === activeId;
            return (
              <Pressable
                key={item.id}
                onPress={() => onSelect(item)}
                accessibilityRole="button"
                accessibilityLabel={`Go to ${item.title}, page ${item.page}`}
                style={({ pressed }) => [
                  s.row,
                  { paddingLeft: Spacing.lg + item.level * Spacing.lg },
                  active && { backgroundColor: surfaceLow },
                  pressed && s.pressed,
                ]}>
                <View style={s.rowText}>
                  <Text
                    numberOfLines={2}
                    style={[
                      s.rowTitle,
                      { color: active ? primary : heading },
                      item.level === 0 && s.topLevel,
                    ]}>
                    {item.title}
                  </Text>
                </View>
                <Text style={[s.page, { color: body }]}>{item.page}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  list: { paddingBottom: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingRight: Spacing.xl,
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: FontSize.sm, lineHeight: 20 },
  topLevel: { fontWeight: '700' },
  page: { fontSize: FontSize.xs, fontWeight: '600' },
  pressed: { opacity: 0.85 },
  empty: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
  },
  emptyText: { fontSize: FontSize.sm, textAlign: 'center' },
});
