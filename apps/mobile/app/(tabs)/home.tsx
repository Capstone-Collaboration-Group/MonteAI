import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { AppHeader } from '@/components/ui/AppHeader';
import { DrawerProvider } from '@/components/ui/DrawerProvider';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { scheduleService } from '@/lib/scheduleService';
import { thesisService } from '@/lib/thesisService';
import type { ScheduleResponseDto, ThesisResponseDto } from '@monteai/types';

const QUICK_ACTIONS = [
  { icon: 'upload-file', label: 'Submit\nThesis', color: '#005d41' },
  { icon: 'menu-book', label: 'Library', color: '#005d41' },
  { icon: 'campaign', label: 'Announce\nments', color: '#005d41' },
  { icon: 'calendar-month', label: 'Schedules', color: '#005d41' },
] as const;

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / 3_600_000);
  if (diffH < 1) return 'Just now';
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'Yesterday';
  if (diffD < 7) return `${diffD} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function HomeScreen() {
  const background = useThemeColor({}, 'background');
  const heading = useThemeColor({}, 'onSurface');
  const body = useThemeColor({}, 'onSurfaceVariant');
  const surface = useThemeColor({}, 'surfaceContainerLow');
  const outline = useThemeColor({}, 'outlineVariant');

  const [schedules, setSchedules] = useState<ScheduleResponseDto[]>([]);
  const [theses, setTheses] = useState<ThesisResponseDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [s, t] = await Promise.all([
          scheduleService.getSchedules(),
          thesisService.getTheses(),
        ]);
        if (active) {
          setSchedules(s.slice(0, 3));
          setTheses(t.slice(0, 3));
        }
      } catch {
        // silently fail — UI stays empty
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  return (
    <DrawerProvider>
      {(openDrawer) => (
    <View style={[s.root, { backgroundColor: background }]}>
      <SafeAreaView style={{ flex: 0 }} edges={['top']}>
        <AppHeader title="MonteSkolar" onLeftPress={openDrawer} rightIcons={[{ icon: 'notifications-none' }]} />
      </SafeAreaView>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Welcome */}
        <View style={s.welcome}>
          <Text style={[s.greeting, { color: body }]}>Welcome back,</Text>
          <Text style={[s.name, { color: heading }]}>Jane Doe</Text>
        </View>

        {/* Quick Actions */}
        <Text style={[s.sectionTitle, { color: heading }]}>Quick Actions</Text>
        <View style={s.actionsGrid}>
          {QUICK_ACTIONS.map((a) => (
            <Pressable key={a.label} style={[s.actionCard, { backgroundColor: surface, borderColor: outline }]} accessibilityRole="button">
              <View style={[s.actionIcon, { backgroundColor: a.color + '14' }]}>
                <MaterialIcons name={a.icon} size={24} color={a.color} />
              </View>
              <Text style={[s.actionLabel, { color: heading }]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Upcoming Defenses */}
        <Text style={[s.sectionTitle, { color: heading }]}>Upcoming Defenses</Text>
        {loading ? (
          <ActivityIndicator size="small" color={body} style={{ marginVertical: Spacing.lg }} />
        ) : schedules.length === 0 ? (
          <Text style={[s.emptyText, { color: body }]}>No upcoming schedules</Text>
        ) : (
          <View style={[s.card, { backgroundColor: surface, borderColor: outline }]}>
            {schedules.map((sch, i) => (
              <React.Fragment key={sch.scheduleId}>
                {i > 0 ? <View style={[s.divider, { backgroundColor: outline }]} /> : null}
                <View style={s.recentRow}>
                  <View style={s.recentDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.recentTitle, { color: heading }]}>
                      {sch.researchGroup?.groupName ?? 'Research Group'}
                    </Text>
                    <Text style={[s.recentTime, { color: body }]}>
                      {sch.date} &middot; {sch.startTime}–{sch.endingTime} @ {sch.roomVenue}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={body} />
                </View>
              </React.Fragment>
            ))}
          </View>
        )}

        {/* Recent Theses */}
        <Text style={[s.sectionTitle, { color: heading }]}>Recent Theses</Text>
        {loading ? (
          <ActivityIndicator size="small" color={body} style={{ marginVertical: Spacing.lg }} />
        ) : theses.length === 0 ? (
          <Text style={[s.emptyText, { color: body }]}>No theses yet</Text>
        ) : (
          <View style={[s.card, { backgroundColor: surface, borderColor: outline }]}>
            {theses.map((t, i) => (
              <React.Fragment key={t.id}>
                {i > 0 ? <View style={[s.divider, { backgroundColor: outline }]} /> : null}
                <View style={s.recentRow}>
                  <View style={s.recentDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.recentTitle, { color: heading }]}>{t.title}</Text>
                    <Text style={[s.recentTime, { color: body }]}>
                      {t.authors?.slice(0, 2).join(', ')} {t.submittedAt ? `\u00B7 ${formatDate(t.submittedAt)}` : ''}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={body} />
                </View>
              </React.Fragment>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
      )}
    </DrawerProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: Spacing.xl, paddingBottom: 100 },
  welcome: { marginBottom: Spacing.xl },
  greeting: { fontSize: FontSize.md },
  name: { fontSize: FontSize.xxl, fontWeight: '700' },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '600', marginBottom: Spacing.md },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.xl },
  actionCard: {
    width: '47%',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  actionIcon: { width: 48, height: 48, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: FontSize.sm, textAlign: 'center', fontWeight: '500' },
  card: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.lg },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  recentDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#005d41' },
  recentTitle: { fontSize: FontSize.md, fontWeight: '500' },
  recentTime: { fontSize: FontSize.xs, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.sm },
  emptyText: { fontSize: FontSize.sm, marginBottom: Spacing.lg },
});
