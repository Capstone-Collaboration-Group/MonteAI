// apps/mobile/app/notifications.tsx
//
// In-app notification feed. Pushed from the bell icons in the tab headers;
// tapping an item marks it read and deep-links to the target screen
// (research group / schedules / announcements). Polls every 30s while open —
// there is no push channel in this stack.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/ui/ScaledText';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useThemeColor } from '@/hooks/use-theme-color';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { notificationService } from '@/lib/notificationService';
import type { NotificationResponseDto } from '@monteai/types';

const POLL_MS = 30_000;

function notificationRoute(targetType: string): string | null {
  switch (targetType) {
    case 'research_group':
      return '/(tabs)/research-group';
    case 'schedule':
      return '/(tabs)/schedules';
    case 'announcement':
      return '/(tabs)/announcements';
    default:
      return null;
  }
}

function timeAgo(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const minutes = Math.floor((Date.now() - then) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NotificationsScreen() {
  const router = useRouter();

  const background = useThemeColor({}, 'background');
  const heading = useThemeColor({}, 'onSurface');
  const body = useThemeColor({}, 'onSurfaceVariant');
  const surface = useThemeColor({}, 'surfaceContainerLow');
  const outline = useThemeColor({}, 'outlineVariant');
  const primary = useThemeColor({}, 'primary');

  const [items, setItems] = useState<NotificationResponseDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const page = await notificationService.getNotifications(1, 50);
      if (!mounted.current) return;
      setItems(page.items);
      setUnreadCount(page.unreadCount);
    } catch {
      // stays empty
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load().finally(() => mounted.current && setLoading(false));

    const timer = setInterval(() => {
      void load();
    }, POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openNotification = useCallback(
    async (notification: NotificationResponseDto) => {
      if (!notification.isRead) {
        try {
          await notificationService.markRead(notification.id);
          setUnreadCount((count) => Math.max(0, count - 1));
        } catch {
          // navigation still proceeds
        }
      }
      const route = notificationRoute(notification.targetType);
      if (route) router.push(route as never);
    },
    [router]
  );

  const markAllRead = useCallback(async () => {
    try {
      await notificationService.markAllRead();
      setUnreadCount(0);
      setItems((list) => list.map((n) => ({ ...n, isRead: true })));
    } catch {
      // best-effort
    }
  }, []);

  const renderItem = ({ item }: { item: NotificationResponseDto }) => (
    <Pressable
      onPress={() => openNotification(item)}
      accessibilityRole="button"
      accessibilityLabel={`Notification: ${item.title}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: item.isRead ? surface : `${primary}0A`,
          borderColor: outline,
        },
        pressed && { opacity: 0.85 },
      ]}>
      <View style={styles.cardRow}>
        {!item.isRead && <View style={[styles.dot, { backgroundColor: primary }]} />}
        <View style={styles.cardText}>
          <View style={styles.cardTop}>
            <Text
              style={[
                styles.cardTitle,
                { color: heading, fontWeight: item.isRead ? '500' : '700' },
              ]}
              numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.time, { color: body }]}>{timeAgo(item.createdAt)}</Text>
          </View>
          <Text style={[styles.cardBody, { color: body }]} numberOfLines={2}>
            {item.body}
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={20} color={body} />
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={heading} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: heading }]}>Notifications</Text>
        {unreadCount > 0 && (
          <Pressable onPress={markAllRead} hitSlop={8} style={styles.backButton}>
            <MaterialIcons name="done-all" size={22} color={primary} />
          </Pressable>
        )}
        {unreadCount === 0 && <View style={styles.backButton} />}
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={body} style={{ marginTop: Spacing.xl }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={body} />
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: body }]}>No notifications yet</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  list: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl * 2,
    gap: Spacing.sm,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  cardTitle: {
    flex: 1,
    fontSize: FontSize.sm,
  },
  time: {
    fontSize: FontSize.xs,
  },
  cardBody: {
    fontSize: FontSize.xs,
    lineHeight: 17,
  },
  empty: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.xl * 2,
  },
});
