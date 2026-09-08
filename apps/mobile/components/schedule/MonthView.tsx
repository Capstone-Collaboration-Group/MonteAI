// apps/mobile/components/schedule/MonthView.tsx
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScheduleResponseDto } from '@monteai/types';
import { useThemeColor } from '@/hooks/use-theme-color';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { getInstituteTheme } from './DefenseCard';
import { toDateKey } from './scheduleTime';

const WEEKDAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MAX_CHIPS = 2;

interface MonthViewProps {
  currentDate: Date;
  schedules: ScheduleResponseDto[];
  activeId?: string;
  onSelect: (schedule: ScheduleResponseDto) => void;
  /** Fired when a day cell is tapped — the screen drills into that day. */
  onDayPress: (date: Date) => void;
}

function buildMonthGrid(date: Date): (Date | null)[][] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstOfMonth.getDay();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
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

/**
 * Month grid (SUN-first). Each day shows up to two institute-colored
 * defense chips — tapping a chip opens the detail sheet, tapping the day
 * itself drills into the day view.
 */
export function MonthView({ currentDate, schedules, activeId, onSelect, onDayPress }: MonthViewProps) {
  const heading = useThemeColor({}, 'onSurface');
  const body = useThemeColor({}, 'onSurfaceVariant');
  const outline = useThemeColor({}, 'outline');
  const outlineVariant = useThemeColor({}, 'outlineVariant');
  const primary = useThemeColor({}, 'primary');
  const primaryContainer = useThemeColor({}, 'primaryContainer');
  const onPrimaryContainer = useThemeColor({}, 'onPrimaryContainer');
  const surface = useThemeColor({}, 'surface');
  const surfaceLow = useThemeColor({}, 'surfaceContainerLow');

  const todayKey = toDateKey(new Date());
  const byDate = useMemo(() => groupByDate(schedules), [schedules]);
  const weeks = useMemo(() => buildMonthGrid(currentDate), [currentDate]);

  const fallback = {
    background: primaryContainer,
    text: onPrimaryContainer,
    border: primaryContainer,
  };

  return (
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      <View style={[s.grid, { borderColor: outline, backgroundColor: surface }]}>
        <View style={[s.weekdayRow, { borderBottomColor: outlineVariant }]}>
          {WEEKDAY_LABELS.map((label) => (
            <View key={label} style={s.weekdayCell}>
              <Text style={[s.weekdayLabel, { color: outline }]}>{label}</Text>
            </View>
          ))}
        </View>

        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} style={[s.weekRow, { borderTopColor: outlineVariant }]}>
            {week.map((date, dayIndex) => {
              if (!date) {
                return <View key={dayIndex} style={[s.cell, { backgroundColor: surfaceLow }]} />;
              }
              const key = toDateKey(date);
              const daySchedules = byDate.get(key) ?? [];
              const isToday = key === todayKey;
              return (
                <Pressable
                  key={dayIndex}
                  style={[s.cell, isToday && { backgroundColor: primary + '0A' }]}
                  onPress={() => onDayPress(date)}
                  accessibilityLabel={`View day ${date.getDate()}`}>
                  <Text
                    style={[
                      s.dayNum,
                      { color: isToday ? primary : heading },
                      isToday && s.dayNumToday,
                    ]}>
                    {date.getDate()}
                  </Text>

                  {daySchedules.slice(0, MAX_CHIPS).map((schedule) => {
                    const theme = getInstituteTheme(schedule.researchGroup?.institute, fallback);
                    const isActive = schedule.scheduleId === activeId;
                    return (
                      <Pressable
                        key={schedule.scheduleId}
                        onPress={() => onSelect(schedule)}
                        accessibilityRole="button"
                        accessibilityLabel={`Defense of ${schedule.researchGroup?.groupName ?? 'group'}`}
                        style={({ pressed }) => [
                          s.chip,
                          {
                            backgroundColor: theme.background,
                            borderColor: isActive ? theme.text : theme.border,
                            borderWidth: isActive ? 1.5 : StyleSheet.hairlineWidth,
                          },
                          pressed && { opacity: 0.8 },
                        ]}>
                        <Text style={[s.chipText, { color: theme.text }]} numberOfLines={1}>
                          {schedule.researchGroup?.groupName ?? 'Untitled Group'}
                        </Text>
                      </Pressable>
                    );
                  })}

                  {daySchedules.length > MAX_CHIPS && (
                    <Text style={[s.moreText, { color: body }]} onPress={() => onDayPress(date)}>
                      +{daySchedules.length - MAX_CHIPS} more
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: Spacing.sm, paddingBottom: Spacing.xxl },
  grid: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  weekdayRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  weekdayCell: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm },
  weekdayLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
  weekRow: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  cell: { flex: 1, minHeight: 92, padding: Spacing.xs, gap: 2 },
  dayNum: { fontSize: FontSize.xs, marginBottom: 2 },
  dayNumToday: { fontWeight: '700' },
  chip: {
    borderRadius: Radius.sm,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: 10, lineHeight: 12, fontWeight: '500' },
  moreText: { fontSize: 10, marginTop: 2, fontWeight: '500' },
});
