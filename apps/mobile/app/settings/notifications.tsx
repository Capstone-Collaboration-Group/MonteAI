import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useThemeColor } from '@/hooks/use-theme-color';
import { FontSize, Spacing } from '@/constants/theme';

export default function NotificationsScreen() {
  const router = useRouter();

  const background = useThemeColor({}, 'background');
  const heading = useThemeColor({}, 'text');
  const body = useThemeColor({}, 'icon');
  const primary = useThemeColor({}, 'primary');
  const border = useThemeColor({}, 'outline');

  const [email, setEmail] = useState(true);
  const [research, setResearch] = useState(false);
  const [thesis, setThesis] = useState(true);

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
          onChange={setEmail}
        />

        <NotificationRow
          title="Research Update"
          subtitle="Get notified about new research and publications"
          value={research}
          onChange={setResearch}
        />

        <NotificationRow
          title="Thesis Repository Announcements"
          subtitle="Receive announcements from the thesis repository"
          value={thesis}
          onChange={setThesis}
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