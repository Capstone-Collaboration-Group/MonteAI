// apps/mobile/components/schedule/DayView.tsx
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScheduleResponseDto } from '@monteai/types';
import { useThemeColor } from '@/hooks/use-theme-color';
import { FontSize, Spacing } from '@/constants/theme';
import { DefenseCard } from './DefenseCard';
import { layoutDaySchedules } from './scheduleLayout';
import { HOUR_HEIGHT, HOUR_LABELS, TIME_COLUMN_WIDTH, toDateKey } from './scheduleTime';

interface DayViewProps {
  date: Date;
  schedules: ScheduleResponseDto[];
  activeId?: string;
  onSelect: (schedule: ScheduleResponseDto) => void;
}

/** Single-day timeline (07:00–19:00) with absolutely positioned defense cards. */
export function DayView({ date, schedules, activeId, onSelect }: DayViewProps) {
  const body = useThemeColor({}, 'onSurfaceVariant');
  const outline = useThemeColor({}, 'outlineVariant');

  const daySchedules = useMemo(
    () => schedules.filter((s) => s.date.slice(0, 10) === toDateKey(date)),
    [schedules, date],
  );
  const laidOut = useMemo(() => layoutDaySchedules(daySchedules), [daySchedules]);

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.row}>
          <View style={[s.timeCol, { borderRightColor: outline }]}>
            {HOUR_LABELS.map((label) => (
              <View key={label} style={s.timeCell}>
                <Text style={[s.timeLabel, { color: body }]}>{label}</Text>
              </View>
            ))}
          </View>

          <View style={[s.grid, { height: HOUR_LABELS.length * HOUR_HEIGHT }]}>
            {HOUR_LABELS.map((_, i) => (
              <View key={i} style={[s.hourLine, { borderTopColor: outline }]}>
                <View style={[s.halfLine, { borderTopColor: outline }]} />
              </View>
            ))}
            {laidOut.map(({ schedule, col, totalCols }) => (
              <DefenseCard
                key={schedule.scheduleId}
                schedule={schedule}
                isActive={schedule.scheduleId === activeId}
                onPress={() => onSelect(schedule)}
                col={col}
                totalCols={totalCols}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      {daySchedules.length === 0 && (
        <View style={s.emptyWrap} pointerEvents="none">
          <Text style={[s.emptyText, { color: body }]}>No defenses scheduled for this day</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: Spacing.xl },
  row: { flexDirection: 'row' },
  timeCol: { width: TIME_COLUMN_WIDTH, borderRightWidth: StyleSheet.hairlineWidth },
  timeCell: {
    height: HOUR_HEIGHT,
    alignItems: 'flex-end',
    paddingRight: Spacing.xs,
    paddingTop: 2,
  },
  timeLabel: { fontSize: 10, fontWeight: '500' },
  grid: { flex: 1 },
  hourLine: { height: HOUR_HEIGHT, borderTopWidth: StyleSheet.hairlineWidth },
  halfLine: {
    position: 'absolute',
    top: HOUR_HEIGHT / 2,
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  emptyWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { fontSize: FontSize.sm, opacity: 0.7 },
});
