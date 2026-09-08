// apps/mobile/app/(tabs)/schedules.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { AppHeader } from '@/components/ui/AppHeader';
import { DrawerProvider } from '@/components/ui/DrawerProvider';
import { DayView } from '@/components/schedule/DayView';
import { WeekView } from '@/components/schedule/WeekView';
import { MonthView } from '@/components/schedule/MonthView';
import { ScheduleDefenseModal } from '@/components/schedule/ScheduleDefenseModal';
import { getWeekDates } from '@/components/schedule/scheduleTime';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { scheduleService } from '@/lib/scheduleService';
import type { ScheduleResponseDto } from '@monteai/types';

type ViewType = 'day' | 'week' | 'month';

const VIEWS: { key: ViewType; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

function RoomChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const primary = useThemeColor({}, 'primary');
  const onPrimary = useThemeColor({}, 'onPrimary');
  const heading = useThemeColor({}, 'onSurface');
  const outline = useThemeColor({}, 'outlineVariant');
  const surface = useThemeColor({}, 'surfaceContainerLow');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Filter by ${label}`}
      style={({ pressed }) => [
        s.roomChip,
        { borderColor: active ? primary : outline, backgroundColor: active ? primary : surface },
        pressed && { opacity: 0.85 },
      ]}>
      <Text
        style={[s.roomChipText, { color: active ? onPrimary : heading }]}
        numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Defense schedule screen — Figma "Defense Schedule" wireframes
 * (nodes 1426-2750 / 1426-2843): Day / Week / Month calendar views with a
 * room filter and tappable defense cards that open a details sheet.
 * Reached from the Home quick actions and the sidebar drawer.
 */
export default function SchedulesScreen() {
  const background = useThemeColor({}, 'background');
  const heading = useThemeColor({}, 'onSurface');
  const body = useThemeColor({}, 'onSurfaceVariant');
  const outline = useThemeColor({}, 'outlineVariant');
  const primary = useThemeColor({}, 'primary');
  const onPrimary = useThemeColor({}, 'onPrimary');

  const [schedules, setSchedules] = useState<ScheduleResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useState<ViewType>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [selected, setSelected] = useState<ScheduleResponseDto | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const data = await scheduleService.getSchedules();
        if (active) setSchedules(Array.isArray(data) ? data : []);
      } catch {
        // stays empty — the calendar renders an empty grid
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const rooms = useMemo(() => {
    const roomSet = new Set(schedules.map((s) => s.roomVenue).filter(Boolean));
    return Array.from(roomSet).sort();
  }, [schedules]);

  // null = "All Rooms"; falls back to All if the chosen room disappears.
  const effectiveRoom =
    selectedRoom !== null && rooms.includes(selectedRoom) ? selectedRoom : null;

  const filtered = useMemo(
    () => (effectiveRoom ? schedules.filter((s) => s.roomVenue === effectiveRoom) : schedules),
    [schedules, effectiveRoom],
  );

  const shiftDay = (delta: number) => {
    setCurrentDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + delta),
    );
  };
  const shiftMonth = (delta: number) => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const goToPrevious = () => {
    if (view === 'day') shiftDay(-1);
    else if (view === 'month') shiftMonth(-1);
    else shiftDay(-7);
  };
  const goToNext = () => {
    if (view === 'day') shiftDay(1);
    else if (view === 'month') shiftMonth(1);
    else shiftDay(7);
  };

  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);

  const headerDateText =
    view === 'day'
      ? currentDate.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : view === 'month'
        ? currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : `${weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} \u2013 ${weekDates[5].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${weekDates[0].getFullYear()}`;

  const openDefense = useCallback((schedule: ScheduleResponseDto) => setSelected(schedule), []);
  const closeDefense = useCallback(() => setSelected(null), []);

  return (
    <DrawerProvider>
      {(openDrawer) => (
        <View style={[s.root, { backgroundColor: background }]}>
          <SafeAreaView style={{ flex: 0 }} edges={['top']}>
            <AppHeader
              title="Defense Schedule"
              onLeftPress={openDrawer}
              rightIcons={[{ icon: 'refresh', onPress: reload }]}
            />
          </SafeAreaView>

          {/* View switcher + Today */}
          <View style={s.toolbar}>
            <View style={[s.segment, { borderColor: outline }]}>
              {VIEWS.map((v) => {
                const active = v.key === view;
                return (
                  <Pressable
                    key={v.key}
                    onPress={() => setView(v.key)}
                    accessibilityRole="button"
                    accessibilityLabel={`${v.label} view`}
                    style={[s.segmentBtn, active && { backgroundColor: primary }]}>
                    <Text style={[s.segmentText, { color: active ? onPrimary : body }]}>
                      {v.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={() => setCurrentDate(new Date())}
              accessibilityRole="button"
              accessibilityLabel="Jump to today"
              style={[s.todayBtn, { borderColor: outline }]}>
              <Text style={[s.todayText, { color: primary }]}>Today</Text>
            </Pressable>
          </View>

          {/* Date navigation */}
          <View style={s.navRow}>
            <Pressable onPress={goToPrevious} hitSlop={8} style={s.navBtn} accessibilityLabel="Previous period">
              <MaterialIcons name="chevron-left" size={22} color={heading} />
            </Pressable>
            <Text style={[s.navDate, { color: heading }]} numberOfLines={1}>
              {headerDateText}
            </Text>
            <Pressable onPress={goToNext} hitSlop={8} style={s.navBtn} accessibilityLabel="Next period">
              <MaterialIcons name="chevron-right" size={22} color={heading} />
            </Pressable>
          </View>

          {/* Room filter */}
          {rooms.length > 1 && (
            <View style={s.roomFilterWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={s.roomChips}>
                <RoomChip label="All Rooms" active={effectiveRoom === null} onPress={() => setSelectedRoom(null)} />
                {rooms.map((room) => (
                  <RoomChip
                    key={room}
                    label={room}
                    active={room === effectiveRoom}
                    onPress={() => setSelectedRoom(room)}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Calendar body */}
          {loading ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator size="large" color={primary} />
            </View>
          ) : (
            <>
              {view === 'day' && (
                <DayView
                  date={currentDate}
                  schedules={filtered}
                  activeId={selected?.scheduleId}
                  onSelect={openDefense}
                />
              )}
              {view === 'week' && (
                <WeekView
                  currentDate={currentDate}
                  schedules={filtered}
                  activeId={selected?.scheduleId}
                  onSelect={openDefense}
                />
              )}
              {view === 'month' && (
                <MonthView
                  currentDate={currentDate}
                  schedules={filtered}
                  activeId={selected?.scheduleId}
                  onSelect={openDefense}
                  onDayPress={(date) => {
                    setCurrentDate(date);
                    setView('day');
                  }}
                />
              )}
            </>
          )}

          {/* Defense details sheet */}
          <ScheduleDefenseModal schedule={selected} onClose={closeDefense} />
        </View>
      )}
    </DrawerProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  segment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  segmentBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs + 2 },
  segmentText: { fontSize: FontSize.sm, fontWeight: '600' },
  todayBtn: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
  },
  todayText: { fontSize: FontSize.sm, fontWeight: '600' },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  navBtn: { padding: Spacing.xs },
  navDate: { flex: 1, textAlign: 'center', fontSize: FontSize.md, fontWeight: '600' },
  roomFilterWrap: {
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  roomChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  roomChip: {
    height: 32,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
  },
  roomChipText: { fontSize: FontSize.xs, fontWeight: '500' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
