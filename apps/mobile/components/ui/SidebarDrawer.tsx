import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Spacing, Radius, FontSize } from '@/constants/theme';

const DRAWER_WIDTH = 320;
const OVERLAY_OPACITY = 0.4;

interface NavItem {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  active?: boolean;
  onPress?: () => void;
}

interface SidebarDrawerProps {
  visible: boolean;
  onClose: () => void;
  activeRoute?: string;
  onNavigate?: (route: string) => void;
}

const NAV_ITEMS: NavItem[] = [
  { icon: 'add-circle', label: 'New Chat' },
  { icon: 'upload-file', label: 'Submit Thesis Document' },
  { icon: 'group', label: 'Research Group' },
  { icon: 'calendar-month', label: 'Schedules' },
  { icon: 'campaign', label: 'Announcements' },
  { icon: 'search', label: 'Find Thesis' },
  { icon: 'chat', label: 'Search Chat' },
];

const RECENT = [
  'Neural Networks in Bio-informatics',
  'Methodology Review: Chapter 3',
  'APA Citation Guidelines 2024',
];

export function SidebarDrawer({ visible, onClose, activeRoute, onNavigate }: SidebarDrawerProps) {
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

        {/* Nav links */}
        <View style={s.nav}>
          {NAV_ITEMS.map((item, i) => {
            const isActive = item.label === activeRoute;
            return (
              <Pressable
                key={item.label}
                onPress={() => {
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
            {RECENT.map((item) => (
              <Pressable key={item} style={s.recentItem} accessibilityRole="button">
                <Text style={[s.recentText, { color: heading }]} numberOfLines={1}>{item}</Text>
              </Pressable>
            ))}
          </View>
        </View>

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
  recentItem: { paddingVertical: Spacing.sm },
  recentText: { fontSize: FontSize.sm },
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
