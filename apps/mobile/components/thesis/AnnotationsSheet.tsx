// apps/mobile/components/thesis/AnnotationsSheet.tsx
//
// "Annotations" dropdown — the live Firestore review comments for the active
// version. Unresolved comments are listed first; resolved ones are collapsible.
// Tapping an entry jumps the PDF to its page and flashes the highlight.

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/use-theme-color';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { BottomSheet } from './BottomSheet';
import type { AnnotationResponseDto } from '@monteai/types';

interface AnnotationsSheetProps {
  visible: boolean;
  annotations: AnnotationResponseDto[];
  onClose: () => void;
  onSelect: (annotation: AnnotationResponseDto) => void;
}

function formatDate(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function AnnotationsSheet({
  visible,
  annotations,
  onClose,
  onSelect,
}: AnnotationsSheetProps) {
  const heading = useThemeColor({}, 'onSurface');
  const body = useThemeColor({}, 'onSurfaceVariant');
  const primary = useThemeColor({}, 'primary');
  const surfaceLow = useThemeColor({}, 'surfaceContainerLow');
  const outline = useThemeColor({}, 'outlineVariant');
  const [showResolved, setShowResolved] = useState(false);

  const unresolved = useMemo(() => annotations.filter((a) => !a.isResolved), [annotations]);
  const resolved = useMemo(() => annotations.filter((a) => a.isResolved), [annotations]);

  const renderCard = (a: AnnotationResponseDto) => (
    <Pressable
      key={a.id}
      onPress={() => onSelect(a)}
      accessibilityRole="button"
      accessibilityLabel={`Go to comment on page ${a.pageNumber}`}
      style={({ pressed }) => [
        s.card,
        { backgroundColor: surfaceLow, borderColor: outline },
        pressed && s.pressed,
      ]}>
      <View style={s.cardTop}>
        <View
          style={[
            s.pageChip,
            { backgroundColor: a.isResolved ? '#dcfce7' : '#fef3c7' },
          ]}>
          <MaterialIcons
            name="arrow-forward"
            size={12}
            color={a.isResolved ? '#15803d' : '#b45309'}
          />
          <Text
            style={[
              s.pageChipText,
              { color: a.isResolved ? '#15803d' : '#b45309' },
            ]}>
            Page {a.pageNumber}
          </Text>
        </View>
        <Text style={[s.date, { color: body }]}>{formatDate(a.createdAt)}</Text>
      </View>

      {a.highlightedText ? (
        <Text numberOfLines={2} style={[s.quote, { color: body, borderLeftColor: outline }]}>
          “{a.highlightedText}”
        </Text>
      ) : null}

      <Text style={[s.comment, { color: heading }]}>{a.comment}</Text>

      {a.isResolved && a.resolverNote ? (
        <Text style={[s.note, { color: body }]}>
          <Text style={s.noteLabel}>Note: </Text>
          {a.resolverNote}
        </Text>
      ) : null}
    </Pressable>
  );

  return (
    <BottomSheet
      visible={visible}
      title="Review Comments"
      subtitle={`${unresolved.length} unresolved · ${resolved.length} resolved`}
      onClose={onClose}>
      {annotations.length === 0 ? (
        <View style={s.empty}>
          <MaterialIcons name="check-circle-outline" size={28} color={outline} />
          <Text style={[s.emptyText, { color: body }]}>
            No review comments on this version yet.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}>
          {unresolved.map(renderCard)}

          {resolved.length > 0 ? (
            <>
              <Pressable
                onPress={() => setShowResolved((p) => !p)}
                style={s.resolvedToggle}
                accessibilityRole="button">
                <Text style={[s.resolvedLabel, { color: primary }]}>
                  Resolved ({resolved.length})
                </Text>
                <MaterialIcons
                  name={showResolved ? 'expand-less' : 'expand-more'}
                  size={20}
                  color={primary}
                />
              </Pressable>
              {showResolved ? resolved.map(renderCard) : null}
            </>
          ) : null}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: Spacing.md },
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  pageChipText: { fontSize: FontSize.xs, fontWeight: '600' },
  date: { fontSize: FontSize.xs },
  quote: {
    fontSize: FontSize.xs,
    fontStyle: 'italic',
    borderLeftWidth: 2,
    paddingLeft: Spacing.sm,
    lineHeight: 18,
  },
  comment: { fontSize: FontSize.sm, lineHeight: 20 },
  note: { fontSize: FontSize.xs, lineHeight: 18 },
  noteLabel: { fontWeight: '700' },
  resolvedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  resolvedLabel: { fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  pressed: { opacity: 0.85 },
  empty: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
  },
  emptyText: { fontSize: FontSize.sm, textAlign: 'center' },
});
