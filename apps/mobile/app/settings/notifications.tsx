import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { Text } from '@/components/ui/ScaledText';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useThemeColor } from '@/hooks/use-theme-color';
import { FontSize, Spacing } from '@/constants/theme';

export const NOTIFICATIONS_STORAGE_KEY = 'monteai.settings.notifications';

type NotificationPrefs = { email: boolean; research: boolean; thesis: boolean };

const DEFAULT_PREFS: NotificationPrefs = { email: true, research: false, thesis: true };

export default function NotificationsScreen() {
  const router = useRouter();

  const background = useThemeColor({}, 'background');
  const heading = useThemeColor({}, 'text');
  const body = useThemeColor({}, 'icon');
  const primary = useThemeColor({}, 'primary');
  const border = useThemeColor({}, 'outline');

  const [email, setEmail] = useState(DEFAULT_PREFS.email);
  const [research, setResearch] = useState(DEFAULT_PREFS.research);
  const [thesis, setThesis] = useState(DEFAULT_PREFS.thesis);

  useEffect(() => {
    AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY)
      .then((stored) => {
        if (!stored) return;
        const parsed = JSON.parse(stored) as Partial<NotificationPrefs>;
        if (typeof parsed.email === 'boolean') setEmail(parsed.email);
        if (typeof parsed.research === 'boolean') setResearch(parsed.research);
        if (typeof parsed.thesis === 'boolean') setThesis(parsed.thesis);
      })
      .catch(() => {
        // keep defaults
      });
  }, []);

  // Persist immediately on any change so the toggles survive navigation/relaunch.
  const update = (key: keyof NotificationPrefs, value: boolean) => {
    const next: NotificationPrefs = { email, research, thesis, [key]: value };
    setEmail(next.email);
    setResearch(next.research);
    setThesis(next.thesis);
    AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(next)).catch(() => {
      // preference is best-effort — next launch retries
    });
  };

  const NotificationRow = ({
    title,
    subtitle,
    value,
    onChange,
  }: {
    title: string;
    subtitle: string;
    value: boolean;
    onChange: (value: boolean) => void;
  }) => (
    <View style={[styles.row, { borderBottomColor: border }]}>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: heading }]}>
          {title}
        </Text>

        <Text style={[styles.rowSubtitle, { color: body }]}>
          {subtitle}
        </Text>
      </View>

      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#999', true: primary }}
        thumbColor="#fff"
      />
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: background }]}
      edges={['top']}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <MaterialIcons
            name="arrow-back"
            size={24}
            color={heading}
            onPress={() => router.back()}
          />

          <Text style={[styles.headerTitle, { color: heading }]}>
            Notifications
          </Text>

          <View style={styles.spacer} />
        </View>

        <Text style={[styles.sectionTitle, { color: heading }]}>
          Notification
        </Text>

        <NotificationRow
          title="Email Notification"
          subtitle="Receive updates and important information via email"
          value={email}
          onChange={(v) => update('email', v)}
        />

        <NotificationRow
          title="Research Update"
          subtitle="Get notified about new research and publications"
          value={research}
          onChange={(v) => update('research', v)}
        />

        <NotificationRow
          title="Thesis Repository Announcements"
          subtitle="Receive announcements from the thesis repository"
          value={thesis}
          onChange={(v) => update('thesis', v)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl * 2,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },

  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.lg,
    fontWeight: '700',
  },

  spacer: {
    width: 24,
  },

  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },

  row: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.sm,
  },

  rowText: {
    flex: 1,
    paddingRight: Spacing.md,
  },

  rowTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },

  rowSubtitle: {
    fontSize: 10,
    marginTop: 3,
  },
});