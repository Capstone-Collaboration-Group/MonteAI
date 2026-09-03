import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { AppHeader } from '@/components/ui/AppHeader';
import { DrawerProvider } from '@/components/ui/DrawerProvider';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { announcementService } from '@/lib/announcementService';
import type { AnnouncementResponseDto } from '@monteai/types';

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

function badgeForIndex(i: number): { label: string; bg: string } {
  const badges = [
    { label: 'URGENT', bg: '#dc2626' },
    { label: 'EVENT', bg: '#005d41' },
    { label: 'UPDATE', bg: '#2563eb' },
  ];
  return badges[i % badges.length];
}

export default function AnnouncementsScreen() {
  const background = useThemeColor({}, 'background');
  const heading = useThemeColor({}, 'onSurface');
  const body = useThemeColor({}, 'onSurfaceVariant');
  const surface = useThemeColor({}, 'surfaceContainerLow');
  const outline = useThemeColor({}, 'outlineVariant');
  const primary = useThemeColor({}, 'primary');

  const [announcements, setAnnouncements] = useState<AnnouncementResponseDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await announcementService.getAnnouncements();
        if (active) setAnnouncements(data);
      } catch {
        // stays empty
      } finally {
        if (active) setLoading(false);
      }
    })();
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
        {/* Header */}
        <Text style={[s.heading, { color: heading }]}>Institutional Announcements</Text>
        <Text style={[s.sub, { color: body }]}>
          Stay updated with the latest faculty updates, thesis defense schedules, and research grant opportunities.
        </Text>

        {/* Actions */}
        <View style={s.actions}>
          <Pressable style={[s.actionBtn, { borderColor: outline }]}>
            <MaterialIcons name="filter-list" size={16} color={heading} />
            <Text style={[s.actionText, { color: heading }]}>Filter</Text>
          </Pressable>
          <Pressable style={[s.actionBtnFilled, { backgroundColor: primary }]}>
            <MaterialIcons name="notifications-active" size={16} color="#fff" />
            <Text style={s.actionTextFilled}>Notify Me</Text>
          </Pressable>
        </View>

        {/* Announcement cards */}
        {loading ? (
          <ActivityIndicator size="small" color={body} style={{ marginVertical: Spacing.xl }} />
        ) : announcements.length === 0 ? (
          <Text style={[s.emptyText, { color: body }]}>No announcements yet</Text>
        ) : (
          announcements.map((a, i) => {
            const badge = badgeForIndex(i);
            return (
              <View key={a.id} style={[s.card, { backgroundColor: surface, borderColor: outline }]}>
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
                  </View>
                  <Pressable style={s.readMore}>
                    <Text style={[s.readMoreText, { color: primary }]}>Read Full Message</Text>
                    <MaterialIcons name="arrow-forward" size={14} color={primary} />
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
      )}
    </DrawerProvider>
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
  emptyText: { fontSize: FontSize.sm, textAlign: 'center', marginVertical: Spacing.xl },
});
