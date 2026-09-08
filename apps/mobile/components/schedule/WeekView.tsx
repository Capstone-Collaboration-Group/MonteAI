// apps/mobile/components/schedule/WeekView.tsx
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScheduleResponseDto } from '@monteai/types';
import { useThemeColor } from '@/hooks/use-theme-color';
import { FontSize, Spacing } from '@/constants/theme';
import { DefenseCard } from './DefenseCard';
import { layoutDaySchedules } from './scheduleLayout';
import { HOUR_HEIGHT, HOUR_LABELS, TIME_COLUMN_WIDTH, getWeekDates, toDateKey } from './scheduleTime';

const WEEKDAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

interface WeekViewProps {
  currentDate: Date;
  schedules: ScheduleResponseDto[];
  activeId?: string;
  onSelect: (schedule: ScheduleResponseDto) => void;
}

function groupByDate(schedules: ScheduleResponseDto[]): Map<string, ScheduleResponseDto[]> {
  const map = new Map<string, ScheduleResponseDto[]>();
  for (const schedule of schedules) {
    const key = schedule.date.slice(0, 10);
    const list = map.get(key);
    if (list) list.push(schedule);
    else map.set(key, [schedule]);
  }
  return map;
}

/** Monday–Saturday grid (07:00–19:00) with compact defense cards per column. */
export function WeekView({ currentDate, schedules, activeId, onSelect }: WeekViewProps) {
  const outline = useThemeColor({}, 'outline');
  const outlineVariant = useThemeColor({}, 'outlineVariant');
  const body = useThemeColor({}, 'onSurfaceVariant');
  const heading = useThemeColor({}, 'onSurface');
  const primary = useThemeColor({}, 'primary');
  const surface = useThemeColor({}, 'surface');

  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);
  const todayKey = toDateKey(new Date());
  const byDate = useMemo(() => groupByDate(schedules), [schedules]);

  return (
    <View style={s.root}>
      {/* Day header — aligned with the grid columns below */}
      <View style={[s.headerRow, { borderBottomColor: outline, backgroundColor: surface }]}>
        <View style={s.headerSpacer} />
        {weekDates.map((date, i) => {
          const isToday = toDateKey(date) === todayKey;
          return (
            <View key={i} style={s.dayHeader}>
              <Text style={[s.dayLabel, { color: isToday ? primary : outlineVariant }]}>
                {WEEKDAY_LABELS[i]}
              </Text>
              <Text style={[s.dayNum, { color: isToday ? primary : heading }]}>{date.getDate()}</Text>
            </View>
          );
        })}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={s.row}>
          <View style={[s.timeCol, { borderRightColor: outlineVariant }]}>
            {HOUR_LABELS.map((label) => (
              <View key={label} style={s.timeCell}>
                <Text style={[s.timeLabel, { color: body }]}>{label}</Text>
              </View>
            ))}
          </View>

          <View style={[s.grid, { height: HOUR_LABELS.length * HOUR_HEIGHT }]}>
            {/* Hour lines behind the columns */}
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              {HOUR_LABELS.map((_, i) => (
                <View key={i} style={[s.hourLine, { borderTopColor: outlineVariant }]}>
                  <View style={[s.halfLine, { borderTopColor: outlineVariant }]} />
                </View>
              ))}
            </View>

            {/* Day columns */}
            <View style={[StyleSheet.absoluteFill, s.columnsRow]}>
              {weekDates.map((date, i) => {
                const laidOut = layoutDaySchedules(byDate.get(toDateKey(date)) ?? []);
                return (
                  <View key={i} style={[s.column, { borderLeftColor: outlineVariant }]}>
                    {laidOut.map(({ schedule, col, totalCols }) => (
                      <DefenseCard
                        key={schedule.scheduleId}
                        schedule={schedule}
                        isActive={schedule.scheduleId === activeId}
                        onPress={() => onSelect(schedule)}
                        col={col}
                        totalCols={totalCols}
                        compact
                      />
                    ))}
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSpacer: { width: TIME_COLUMN_WIDTH },
  dayHeader: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, gap: 2 },
  dayLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
  dayNum: { fontSize: FontSize.sm, fontWeight: '700' },
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
  columnsRow: { flexDirection: 'row' },
  column: {
    flex: 1,
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  hourLine: { height: HOUR_HEIGHT, borderTopWidth: StyleSheet.hairlineWidth },
  halfLine: {
    position: 'absolute',
    top: HOUR_HEIGHT / 2,
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
});
