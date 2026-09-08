// apps/mobile/components/schedule/ScheduleDefenseModal.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ScheduleResponseDto } from '@monteai/types';
import { useThemeColor } from '@/hooks/use-theme-color';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { parseDateKey } from './scheduleTime';

interface ScheduleDefenseModalProps {
  schedule: ScheduleResponseDto | null;
  onClose: () => void;
}

const BACKDROP_OPACITY = 0.4;
const SHEET_HIDDEN_OFFSET = 800;

interface FactRowProps {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  value: string;
  iconColor: string;
  labelColor: string;
  valueColor: string;
}

function FactRow({ icon, label, value, iconColor, labelColor, valueColor }: FactRowProps) {
  return (
    <View style={s.factRow}>
      <MaterialIcons name={icon} size={20} color={iconColor} />
      <View style={s.factText}>
        <Text style={[s.label, { color: labelColor }]}>{label}</Text>
        <Text style={[s.factValue, { color: valueColor }]}>{value}</Text>
      </View>
    </View>
  );
}

/**
 * Bottom sheet with the full defense details — the mobile counterpart of
 * the web ScheduleDetailPanel. Opens when a defense card/chip is tapped.
 */
export function ScheduleDefenseModal({ schedule, onClose }: ScheduleDefenseModalProps) {
  const visible = schedule !== null;
  const translateY = useRef(new Animated.Value(SHEET_HIDDEN_OFFSET)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  // Keep the last schedule mounted while the sheet slides out so the exit
  // animation doesn't flash an empty panel.
  const [lastSchedule, setLastSchedule] = useState<ScheduleResponseDto | null>(null);
  useEffect(() => {
    if (schedule) setLastSchedule(schedule);
  }, [schedule]);
  const display = schedule ?? lastSchedule;

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
  const surfaceHigh = useThemeColor({}, 'surfaceContainerHigh');
  const surfaceLow = useThemeColor({}, 'surfaceContainerLow');
  const heading = useThemeColor({}, 'onSurface');
  const body = useThemeColor({}, 'onSurfaceVariant');
  const outline = useThemeColor({}, 'outlineVariant');
  const primary = useThemeColor({}, 'primary');
  const onPrimary = useThemeColor({}, 'onPrimary');
  const secondaryContainer = useThemeColor({}, 'secondaryContainer');

  const defenseDate = display
    ? parseDateKey(display.date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';
  const panelists = display?.panelists ?? [];

  return (
    <View style={s.container} pointerEvents={visible ? 'box-none' : 'none'}>
      <Animated.View style={[s.backdrop, { opacity: overlayOpacity }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close defense details"
        />
      </Animated.View>

      <Animated.View
        style={[
          s.sheet,
          {
            backgroundColor: surface,
            paddingBottom: Math.max(insets.bottom, Spacing.lg),
            transform: [{ translateY }],
          },
        ]}>
        {display && (
          <ScrollView contentContainerStyle={s.content} bounces={false} showsVerticalScrollIndicator={false}>
            <View style={s.headerRow}>
              <Text style={[s.title, { color: heading }]}>Defense Details</Text>
              <Pressable onPress={onClose} hitSlop={8} style={s.closeBtn} accessibilityLabel="Close">
                <MaterialIcons name="close" size={20} color={body} />
              </Pressable>
            </View>

            {display.researchGroup && (
              <View style={[s.groupCard, { backgroundColor: surfaceLow, borderColor: outline }]}>
                <View style={s.groupRow}>
                  <View style={[s.groupIcon, { backgroundColor: primary }]}>
                    <MaterialIcons name="groups" size={22} color={onPrimary} />
                  </View>
                  <View style={s.groupHead}>
                    <Text style={[s.labelUppercase, { color: outline }]}>GROUP IDENTITY</Text>
                    <Text style={[s.groupName, { color: heading }]} numberOfLines={1}>
                      {display.researchGroup.groupName}
                    </Text>
                  </View>
                </View>
                <View style={s.groupMeta}>
                  <Text style={[s.label, { color: body }]}>Research Title</Text>
                  <Text style={[s.groupValue, { color: heading }]}>
                    {display.researchGroup.researchTitle}
                  </Text>
                  <Text style={[s.label, { color: body }]}>Group Leader</Text>
                  <Text style={[s.groupValue, { color: heading }]}>
                    {display.researchGroup.leaderId}
                  </Text>
                </View>
              </View>
            )}

            <View style={s.facts}>
              <FactRow
                icon="event"
                label="Defense Date"
                value={defenseDate}
                iconColor={primary}
                labelColor={outline}
                valueColor={heading}
              />
              <FactRow
                icon="schedule"
                label="Time Slot"
                value={`${display.startTime} - ${display.endingTime}`}
                iconColor={primary}
                labelColor={outline}
                valueColor={heading}
              />
              <FactRow
                icon="place"
                label="Defense Venue"
                value={display.roomVenue}
                iconColor={primary}
                labelColor={outline}
                valueColor={heading}
              />
            </View>

            <View style={s.panelistSection}>
              <View style={s.panelistHeading}>
                <Text style={[s.labelUppercase, { color: body }]}>ASSIGNED PANELISTS</Text>
                <View style={[s.countBadge, { backgroundColor: primary }]}>
                  <Text style={s.countText}>{panelists.length} MEMBERS</Text>
                </View>
              </View>

              {panelists.length > 0 ? (
                <View style={s.panelistList}>
                  {panelists.map((panelist) => (
                    <View key={`${panelist.panelistId}-${panelist.panelistType}`} style={s.panelistRow}>
                      <View style={[s.panelistAvatar, { backgroundColor: secondaryContainer }]}>
                        <Text style={[s.panelistInitial, { color: heading }]}>
                          {panelist.panelistId.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={[s.panelistName, { color: heading }]} numberOfLines={1}>
                        {panelist.panelistId}
                      </Text>
                      <View style={[s.typeChip, { backgroundColor: surfaceHigh }]}>
                        <Text style={[s.typeText, { color: body }]}>{panelist.panelistType}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[s.noPanelists, { color: body }]}>No panelists assigned</Text>
              )}
            </View>
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
  content: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, gap: Spacing.xl },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: FontSize.lg, fontWeight: '700' },
  closeBtn: { padding: Spacing.sm },
  groupCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  groupIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupHead: { flex: 1, gap: 2 },
  groupName: { fontSize: FontSize.md, fontWeight: '700' },
  groupMeta: { gap: 2 },
  label: { fontSize: FontSize.xs, opacity: 0.8 },
  groupValue: { fontSize: FontSize.sm, fontWeight: '600', marginBottom: Spacing.xs },
  labelUppercase: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  facts: { gap: Spacing.lg },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  factText: { flex: 1, gap: 1 },
  factValue: { fontSize: FontSize.sm, fontWeight: '600' },
  panelistSection: { gap: Spacing.md, paddingBottom: Spacing.sm },
  panelistHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.sm },
  countText: { color: '#ffffff', fontSize: 10, fontWeight: '700' },
  panelistList: { gap: Spacing.xs },
  panelistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  panelistAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelistInitial: { fontSize: FontSize.sm, fontWeight: '700' },
  panelistName: { flex: 1, fontSize: FontSize.sm, fontWeight: '500' },
  typeChip: {
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  typeText: { fontSize: 10, fontWeight: '600' },
  noPanelists: { fontSize: FontSize.sm },
});
