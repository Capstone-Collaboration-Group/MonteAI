import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useDrawerChats } from '@/hooks/useDrawerChats';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { AppHeader } from '@/components/ui/AppHeader';
import { DrawerProvider } from '@/components/ui/DrawerProvider';
import { TabScreenTransition } from '@/components/ui/TabScreenTransition';
import { AnnouncementDetailModal } from '@/components/announcement/AnnouncementDetailModal';
import { BottomSheet } from '@/components/thesis/BottomSheet';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { announcementService } from '@/lib/announcementService';
import type { AnnouncementResponseDto } from '@monteai/types';

type PriorityFilter = AnnouncementResponseDto['priority'] | null;

const PRIORITY_FILTERS: { label: string; sub: string; value: PriorityFilter }[] = [
  { label: 'All', sub: 'No priority filter', value: null },
  { label: 'Urgent', sub: 'Critical updates only', value: 'Urgent' },
  { label: 'Important', sub: 'Important notices', value: 'Important' },
  { label: 'Normal', sub: 'Everything else', value: 'Normal' },
];

function timeAgo(iso?: string): string {
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

function badgeForPriority(priority: AnnouncementResponseDto['priority']): { label: string; bg: string } {
  switch (priority) {
    case 'Urgent':
      return { label: 'URGENT', bg: '#dc2626' };
    case 'Important':
      return { label: 'IMPORTANT', bg: '#2563eb' };
    default:
      return { label: 'UPDATE', bg: '#005d41' };
  }
}

export default function AnnouncementsScreen() {
  const router = useRouter();
  const background = useThemeColor({}, 'background');
  const heading = useThemeColor({}, 'onSurface');
  const body = useThemeColor({}, 'onSurfaceVariant');
  const surface = useThemeColor({}, 'surfaceContainerLow');
  const outline = useThemeColor({}, 'outlineVariant');
  const primary = useThemeColor({}, 'primary');

  const [announcements, setAnnouncements] = useState<AnnouncementResponseDto[]>([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AnnouncementResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [priority, setPriority] = useState<PriorityFilter>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const { recentChats, loading: chatsLoading } = useDrawerChats();
  const openAnnouncement = useCallback((announcement: AnnouncementResponseDto) => {
    setSelectedAnnouncement(announcement);
  }, []);
  const closeAnnouncement = useCallback(() => setSelectedAnnouncement(null), []);

  const loadAnnouncements = useCallback(async () => {
    try {
      const data = await announcementService.getAnnouncements();
      setAnnouncements(data);
    } catch {
      // stays empty
    }
  }, []);

  useEffect(() => {
    let active = true;
    loadAnnouncements().finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [loadAnnouncements]);

  const { refreshControl } = usePullToRefresh(loadAnnouncements);

  // Priority filter — client-side over the already-fetched list.
  const visibleAnnouncements = priority
    ? announcements.filter((a) => a.priority === priority)
    : announcements;

  return (
    <TabScreenTransition>
    <DrawerProvider recentChats={recentChats} recentLoading={chatsLoading}>
      {(openDrawer) => (
    <View style={[s.root, { backgroundColor: background }]}>
      <SafeAreaView style={{ flex: 0 }} edges={['top']}>
        <AppHeader title="MonteSkolar" onLeftPress={openDrawer} rightIcons={[{ icon: 'notifications-none', onPress: () => router.push('/notifications') }]} />
      </SafeAreaView>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} refreshControl={refreshControl}>
        {/* Header */}
        <Text style={[s.heading, { color: heading }]}>Institutional Announcements</Text>
        <Text style={[s.sub, { color: body }]}>
          Stay updated with the latest faculty updates, thesis defense schedules, and research grant opportunities.
        </Text>

        {/* Actions */}
        <View style={s.actions}>
          <Pressable
            onPress={() => setFilterOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={priority ? `Filter, ${priority} selected` : 'Filter'}
            style={({ pressed }) => [
              s.actionBtn,
              { borderColor: priority ? primary : outline },
              pressed && { opacity: 0.85 },
            ]}>
            <MaterialIcons name="filter-list" size={16} color={heading} />
            <Text style={[s.actionText, { color: heading }]}>
              {priority ? `Filter · ${priority}` : 'Filter'}
            </Text>
          </Pressable>
          <Pressable style={[s.actionBtnFilled, { backgroundColor: primary }]}>
            <MaterialIcons name="notifications-active" size={16} color="#fff" />
            <Text style={s.actionTextFilled}>Notify Me</Text>
          </Pressable>
        </View>

        {/* Announcement cards */}
        {loading ? (
          <ActivityIndicator size="small" color={body} style={{ marginVertical: Spacing.xl }} />
        ) : visibleAnnouncements.length === 0 ? (
          <Text style={[s.emptyText, { color: body }]}>
            {priority ? `No ${priority.toLowerCase()} announcements` : 'No announcements yet'}
          </Text>
        ) : (
          visibleAnnouncements.map((a) => {
            const badge = badgeForPriority(a.priority);
            return (
              <Pressable
                key={a.id}
                onPress={() => openAnnouncement(a)}
                accessibilityRole="button"
                accessibilityLabel={`Read announcement: ${a.subject}`}
                style={({ pressed }) => [
                  s.card,
                  { backgroundColor: surface, borderColor: outline },
                  pressed && { opacity: 0.85 },
                ]}>
                <View style={s.cardTop}>
                  <View style={[s.badge, { backgroundColor: badge.bg + '18' }]}>
                    <Text style={[s.badgeText, { color: badge.bg }]}>{badge.label}</Text>
                  </View>
                  <Text style={[s.time, { color: body }]}>{timeAgo(a.createdAt)}</Text>
                </View>
                <Text style={[s.cardTitle, { color: heading }]}>{a.subject}</Text>
                <Text style={[s.cardBody, { color: body }]} numberOfLines={3}>{a.content}</Text>
                <View style={s.cardFooter}>
                  <View style={s.sourceRow}>
                    <MaterialIcons name="account-circle" size={16} color={body} />
                    <Text style={[s.source, { color: body }]}>{a.author?.fullName ?? 'Admin'}</Text>
                    {!!a.attachmentUrls?.length && (
                      <MaterialIcons
                        name="attach-file"
                        size={14}
                        color={body}
                        accessibilityLabel={`${a.attachmentUrls.length} attachment(s)`}
                      />
                    )}
                  </View>
                  <View style={s.readMore}>
                    <Text style={[s.readMoreText, { color: primary }]}>Read Full Message</Text>
                    <MaterialIcons name="arrow-forward" size={14} color={primary} />
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
      {/* Priority filter sheet — selection applies immediately and closes */}
      <BottomSheet
        visible={filterOpen}
        title="Filter announcements"
        subtitle={priority ? `Showing ${priority} announcements` : 'Showing all priorities'}
        onClose={() => setFilterOpen(false)}>
        <View style={s.filterList}>
          {PRIORITY_FILTERS.map((f) => {
            const active = priority === f.value;
            return (
              <Pressable
                key={f.label}
                onPress={() => {
                  setPriority(f.value);
                  setFilterOpen(false);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Filter: ${f.label}`}
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  s.filterRow,
                  { borderColor: active ? primary : outline },
                  pressed && { opacity: 0.85 },
                ]}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.filterRowTitle, { color: active ? primary : heading }]}>{f.label}</Text>
                  <Text style={[s.filterRowMeta, { color: body }]}>{f.sub}</Text>
                </View>
                {active ? <MaterialIcons name="check" size={18} color={primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
      <AnnouncementDetailModal announcement={selectedAnnouncement} onClose={closeAnnouncement} />
    </View>
      )}
    </DrawerProvider>
    </TabScreenTransition>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: Spacing.xl, paddingBottom: 100, gap: Spacing.md },
  heading: { fontSize: FontSize.xxl, fontWeight: '700' },
  sub: { fontSize: FontSize.sm, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: Spacing.xs },
  actionText: { fontSize: FontSize.sm, fontWeight: '500' },
  actionBtnFilled: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: Spacing.xs },
  actionTextFilled: { color: '#fff', fontSize: FontSize.sm, fontWeight: '500' },
  card: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.lg, gap: Spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.sm },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  time: { fontSize: FontSize.xs },
  cardTitle: { fontSize: FontSize.lg, fontWeight: '600', lineHeight: 24 },
  cardBody: { fontSize: FontSize.sm, lineHeight: 20 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.xs },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  source: { fontSize: FontSize.xs },
  readMore: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  readMoreText: { fontSize: FontSize.xs, fontWeight: '600' },
  filterList: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: Spacing.sm },
  filterRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radius.md, padding: Spacing.lg },
  filterRowTitle: { fontSize: FontSize.md, fontWeight: '700' },
  filterRowMeta: { fontSize: FontSize.xs, marginTop: 2 },
  emptyText: { fontSize: FontSize.sm, textAlign: 'center', marginVertical: Spacing.xl },
});
