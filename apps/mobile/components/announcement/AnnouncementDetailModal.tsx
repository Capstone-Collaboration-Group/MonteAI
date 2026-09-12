import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AnnouncementResponseDto } from '@monteai/types';
import { useThemeColor } from '@/hooks/use-theme-color';
import { FontSize, Radius, Spacing } from '@/constants/theme';

interface AnnouncementDetailModalProps {
  announcement: AnnouncementResponseDto | null;
  onClose: () => void;
}

const BACKDROP_OPACITY = 0.4;
const SHEET_HIDDEN_OFFSET = 800;

function formatPostedAt(value?: string): string {
  if (!value) return 'Date unavailable';
  return new Date(value).toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function AnnouncementDetailModal({ announcement, onClose }: AnnouncementDetailModalProps) {
  const visible = announcement !== null;
  const translateY = useRef(new Animated.Value(SHEET_HIDDEN_OFFSET)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const [lastAnnouncement, setLastAnnouncement] = useState<AnnouncementResponseDto | null>(null);

  useEffect(() => {
    if (announcement) setLastAnnouncement(announcement);
  }, [announcement]);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: visible ? 0 : SHEET_HIDDEN_OFFSET,
        useNativeDriver: true,
        damping: 30,
        stiffness: 300,
      }),
      Animated.timing(overlayOpacity, {
        toValue: visible ? BACKDROP_OPACITY : 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, translateY, overlayOpacity]);

  const surface = useThemeColor({}, 'surface');
  const surfaceLow = useThemeColor({}, 'surfaceContainerLow');
  const heading = useThemeColor({}, 'onSurface');
  const body = useThemeColor({}, 'onSurfaceVariant');
  const outline = useThemeColor({}, 'outlineVariant');
  const primary = useThemeColor({}, 'primary');
  const display = announcement ?? lastAnnouncement;

  return (
    <View style={s.container} pointerEvents={visible ? 'box-none' : 'none'}>
      <Animated.View style={[s.backdrop, { opacity: overlayOpacity }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close announcement details"
        />
      </Animated.View>

      <Animated.View
        style={[
          s.sheet,
          { backgroundColor: surface, paddingBottom: Math.max(insets.bottom, Spacing.lg), transform: [{ translateY }] },
        ]}>
        {display && (
          <ScrollView contentContainerStyle={s.content} bounces={false} showsVerticalScrollIndicator={false}>
            <View style={s.headerRow}>
              <Text style={[s.detailLabel, { color: primary }]}>ANNOUNCEMENT</Text>
              <Pressable onPress={onClose} hitSlop={8} style={s.closeBtn} accessibilityLabel="Close">
                <MaterialIcons name="close" size={20} color={body} />
              </Pressable>
            </View>

            <Text style={[s.title, { color: heading }]}>{display.subject}</Text>

            <View style={[s.meta, { backgroundColor: surfaceLow, borderColor: outline }]}>
              <View style={s.metaRow}>
                <MaterialIcons name="account-circle" size={20} color={primary} />
                <View style={s.metaText}>
                  <Text style={[s.label, { color: body }]}>Posted by</Text>
                  <Text style={[s.value, { color: heading }]}>{display.author.fullName || display.author.role}</Text>
                </View>
              </View>
              <View style={s.metaRow}>
                <MaterialIcons name="schedule" size={20} color={primary} />
                <View style={s.metaText}>
                  <Text style={[s.label, { color: body }]}>Date and time posted</Text>
                  <Text style={[s.value, { color: heading }]}>{formatPostedAt(display.createdAt)}</Text>
                </View>
              </View>
            </View>

            <Text style={[s.contentText, { color: body }]}>{display.content}</Text>
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, zIndex: 1000 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '85%',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
  content: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, gap: Spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailLabel: { fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 1 },
  closeBtn: { padding: Spacing.sm },
  title: { fontSize: FontSize.xxl, fontWeight: '700', lineHeight: 34 },
  meta: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  metaText: { flex: 1, gap: Spacing.xxs },
  label: { fontSize: FontSize.xs },
  value: { fontSize: FontSize.sm, fontWeight: '600' },
  contentText: { fontSize: FontSize.md, lineHeight: 26 },
});