import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Spacing, Radius, FontSize } from '@/constants/theme';

const DRAWER_WIDTH = 320;
const OVERLAY_OPACITY = 0.4;

type DrawerRoute = '/(tabs)/schedules' | '/(tabs)/announcements';

interface NavItem {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  active?: boolean;
  onPress?: () => void;
  route?: DrawerRoute;
}

export interface DrawerRecentChat {
  id: string;
  title: string;
}

interface SidebarDrawerProps {
  visible: boolean;
  onClose: () => void;
  activeRoute?: string;
  onNavigate?: (route: string) => void;
  recentChats?: DrawerRecentChat[];
  recentLoading?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { icon: 'upload-file', label: 'Submit Thesis Document' },
  { icon: 'group', label: 'Research Group' },
  { icon: 'calendar-month', label: 'Schedules', route: '/(tabs)/schedules' },
  { icon: 'campaign', label: 'Announcements', route: '/(tabs)/announcements' },
  { icon: 'search', label: 'Find Thesis' },
  { icon: 'chat', label: 'Search Chat' },
];

const LEGACY_RECENT = [
  'Neural Networks in Bio-informatics',
  'Methodology Review: Chapter 3',
  'APA Citation Guidelines 2024',
];

export function SidebarDrawer({
  visible,
  onClose,
  activeRoute,
  onNavigate,
  recentChats,
  recentLoading,
}: SidebarDrawerProps) {
  const router = useRouter();
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const surface = useThemeColor({}, 'surface');
  const heading = useThemeColor({}, 'onSurface');
  const body = useThemeColor({}, 'onSurfaceVariant');
  const primary = useThemeColor({}, 'primary');
  const outline = useThemeColor({}, 'outlineVariant');
  const onPrimary = useThemeColor({}, 'onPrimary');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: visible ? 0 : -DRAWER_WIDTH,
        useNativeDriver: true,
        damping: 30,
        stiffness: 200,
      }),
      Animated.timing(overlayOpacity, {
        toValue: visible ? OVERLAY_OPACITY : 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, translateX, overlayOpacity]);

  const navItems: NavItem[] = [
    {
      icon: 'add-circle',
      label: 'New Chat',
      // Navigate to the chat tab and start a fresh chat — works from any tab.
      // The timestamp keeps the param unique so every tap is handled.
      onPress: () =>
        router.navigate({
          pathname: '/(tabs)/chat',
          params: { open: `n:${Date.now()}` },
        }),
    },
    ...NAV_ITEMS,
  ];

  return (
    <View
      style={s.container}
      pointerEvents={visible ? 'box-none' : 'none'}>
      {/* Backdrop */}
      <Animated.View style={[s.backdrop, { opacity: overlayOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Drawer panel */}
      <Animated.View
        style={[
          s.drawer,
          {
            backgroundColor: surface,
            width: DRAWER_WIDTH,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            transform: [{ translateX }],
          },
        ]}>
        {/* Header */}
        <View style={s.header}>
          <Text style={[s.brand, { color: primary }]}>MonteSkolar</Text>
          <Pressable onPress={onClose} hitSlop={8} style={s.closeBtn}>
            <MaterialIcons name="close" size={18} color={body} />
          </Pressable>
        </View>

        {/* Nav links — scrollable so older sessions are reachable */}
        <ScrollView style={s.nav} contentContainerStyle={s.navContent}>
          {navItems.map((item, i) => {
            const isActive = item.label === activeRoute;
            return (
              <Pressable
                key={item.label}
                onPress={() => {
                  if (item.route) router.push(item.route);
                  item.onPress?.();
                  onNavigate?.(item.label);
                  onClose();
                }}
                style={[
                  s.navItem,
                  isActive && { backgroundColor: primary, borderRadius: Radius.md },
                  i === 1 && { paddingTop: Spacing.xl },
                ]}
                accessibilityRole="button">
                <MaterialIcons
                  name={item.icon}
                  size={20}
                  color={isActive ? onPrimary : body}
                />
                <Text style={[s.navLabel, { color: isActive ? onPrimary : heading }]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}

          {/* Recent section */}
          <View style={s.recentSection}>
            <Text style={[s.recentHeading, { color: body }]}>RECENT</Text>
            {recentChats ? (
              recentLoading ? (
                <View style={s.recentLoadingRow}>
                  <ActivityIndicator size="small" color={primary} />
                  <Text style={[s.recentText, { color: body }]}>Loading chats...</Text>
                </View>
              ) : recentChats.length === 0 ? (
                <Text style={[s.recentEmpty, { color: body }]}>No conversations yet</Text>
              ) : (
                recentChats.map((chat) => (
                  <Pressable
                    key={chat.id}
                    style={s.recentItem}
                    onPress={() => {
                      // Navigate to the chat tab and open this session —
                      // works from any tab. The timestamp keeps the param
                      // unique so every tap is handled.
                      router.navigate({
                        pathname: '/(tabs)/chat',
                        params: { open: `s:${chat.id}:${Date.now()}` },
                      });
                      onClose();
                    }}
                    accessibilityRole="button">
                    <Text style={[s.recentText, { color: heading }]} numberOfLines={1}>
                      {chat.title}
                    </Text>
                  </Pressable>
                ))
              )
            ) : (
              LEGACY_RECENT.map((item) => (
                <Pressable key={item} style={s.recentItem} accessibilityRole="button">
                  <Text style={[s.recentText, { color: heading }]} numberOfLines={1}>{item}</Text>
                </Pressable>
              ))
            )}
          </View>
        </ScrollView>

        {/* User profile footer */}
        <View style={[s.footer, { borderTopColor: outline }]}>
          <View style={s.userRow}>
            <View style={[s.avatar, { backgroundColor: primary }]}>
              <Text style={[s.avatarText, { color: onPrimary }]}>JD</Text>
            </View>
            <View style={s.userInfo}>
              <Text style={[s.userName, { color: heading }]}>Jane Doe</Text>
              <Text style={[s.userRole, { color: body }]}>Academic Researcher</Text>
            </View>
          </View>
          <Pressable hitSlop={8}>
            <MaterialIcons name="settings" size={20} color={body} />
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, zIndex: 999 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    borderTopRightRadius: Radius.sm,
    borderBottomRightRadius: Radius.sm,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  brand: { fontSize: FontSize.xl, fontWeight: '700' },
  closeBtn: { padding: Spacing.xs },
  nav: { flex: 1, paddingHorizontal: Spacing.sm },
  navContent: { paddingVertical: Spacing.sm },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  navLabel: { fontSize: FontSize.sm, fontWeight: '600' },
  recentSection: { marginTop: Spacing.xl, paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  recentHeading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: Spacing.xs,
  },
  recentItem: { paddingVertical: Spacing.sm, borderRadius: Radius.sm },
  recentText: { fontSize: FontSize.sm },
  recentLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  recentEmpty: { fontSize: FontSize.sm, paddingVertical: Spacing.sm },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: FontSize.md, fontWeight: '700' },
  userInfo: { gap: 2 },
  userName: { fontSize: FontSize.md, fontWeight: '500' },
  userRole: { fontSize: 10 },
});
