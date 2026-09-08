// apps/mobile/components/schedule/DefenseCard.tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ScheduleResponseDto } from '@monteai/types';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Radius, Spacing } from '@/constants/theme';
import { GRID_END_MIN, GRID_START_MIN, timeToMinutes } from './scheduleTime';

export interface InstituteTheme {
  background: string;
  text: string;
  border: string;
}

/**
 * Institute → chip colors. Same mapping as the web DefenseCard: ICS orange,
 * ITE blue, IBE yellow, everything else the theme's primary container. The
 * institute pastels are fixed across color schemes so chips stay readable
 * in light and dark mode.
 */
export function getInstituteTheme(
  institute: string | undefined,
  fallback: InstituteTheme,
): InstituteTheme {
  const inst = (institute ?? '').toLowerCase();
  if (inst.includes('computing') || inst.includes('ics')) {
    return { background: '#ffedd5', text: '#9a3412', border: '#fdba74' };
  }
  if (inst.includes('teaching') || inst.includes('education') || inst.includes('ite')) {
    return { background: '#dbeafe', text: '#1e40af', border: '#93c5fd' };
  }
  if (inst.includes('business') || inst.includes('entrepreneurship') || inst.includes('ibe')) {
    return { background: '#fef9c3', text: '#a16207', border: '#fde68a' };
  }
  return fallback;
}

interface DefenseCardProps {
  schedule: ScheduleResponseDto;
  isActive: boolean;
  onPress: () => void;
  col: number;
  totalCols: number;
  /** Week view: minimal content sized for narrow (~55px) columns. */
  compact?: boolean;
}

export function DefenseCard({
  schedule,
  isActive,
  onPress,
  col,
  totalCols,
  compact = false,
}: DefenseCardProps) {
  const primaryContainer = useThemeColor({}, 'primaryContainer');
  const onPrimaryContainer = useThemeColor({}, 'onPrimaryContainer');
  const theme = getInstituteTheme(schedule.researchGroup?.institute, {
    background: primaryContainer,
    text: onPrimaryContainer,
    border: primaryContainer,
  });

  // 1px = 1 minute from 07:00 — clamped so out-of-grid entries stay visible.
  const startMin = timeToMinutes(schedule.startTime);
  const endMin = timeToMinutes(schedule.endingTime);
  const top = Math.max(0, startMin - GRID_START_MIN);
  const clampedEnd = Math.max(startMin + 1, Math.min(endMin, GRID_END_MIN));
  const height = Math.max(30, clampedEnd - startMin - 2);

  const widthPct = 100 / totalCols;
  const leftPct = col * widthPct;

  const groupName = schedule.researchGroup?.groupName ?? 'Untitled Group';
  const panelists = schedule.panelists ?? [];
  const showPanelists = isActive && !compact && height > 60 && panelists.length > 0;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top,
        height,
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        zIndex: isActive ? 20 : 10,
        paddingHorizontal: 2,
        paddingVertical: 1,
      }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Defense of ${groupName}`}
        style={({ pressed }) => [
          s.card,
          compact && s.cardCompact,
          {
            backgroundColor: theme.background,
            borderColor: isActive ? theme.text : theme.border,
            borderWidth: isActive ? 2 : StyleSheet.hairlineWidth,
          },
          pressed && { opacity: 0.85 },
        ]}>
        <Text
          style={[s.title, { color: theme.text }, compact && s.titleCompact]}
          numberOfLines={compact ? 2 : 1}>
          {groupName}
        </Text>
        <Text style={[s.meta, { color: theme.text }]} numberOfLines={1}>
          {compact ? schedule.startTime : `${schedule.startTime} · ${schedule.roomVenue}`}
        </Text>
        {showPanelists && (
          <View style={s.panelistRow}>
            {panelists.slice(0, 3).map((panelist, i) => (
              <View
                key={`${panelist.panelistId}-${i}`}
                style={[
                  s.panelistAvatar,
                  { borderColor: theme.text },
                  i > 0 && { marginLeft: -8 },
                ]}>
                <Text style={[s.panelistInitial, { color: theme.text }]}>
                  {panelist.panelistId.charAt(0).toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: Spacing.xs,
    gap: 2,
    overflow: 'hidden',
  },
  cardCompact: { paddingHorizontal: 3, paddingVertical: 2, gap: 0 },
  title: { fontSize: 11, fontWeight: '700', lineHeight: 13 },
  titleCompact: { fontSize: 9, lineHeight: 11 },
  meta: { fontSize: 10, opacity: 0.85, lineHeight: 12 },
  panelistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  panelistAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  panelistInitial: { fontSize: 10, fontWeight: '700' },
});
