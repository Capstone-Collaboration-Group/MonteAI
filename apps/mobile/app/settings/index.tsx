import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useThemeColor } from '@/hooks/use-theme-color';
import { FontSize, Spacing } from '@/constants/theme';

type SettingRowProps = {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  title: string;
  subtitle: string;
  onPress: () => void;
};

function SettingRow({
  icon,
  title,
  subtitle,
  onPress,
}: SettingRowProps) {
  const heading = useThemeColor({}, 'text');
  const body = useThemeColor({}, 'icon');
  const primary = useThemeColor({}, 'primary');
  const border = useThemeColor({}, 'outline');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: border },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: `${primary}18` }]}>
        <MaterialIcons name={icon} size={22} color={primary} />
      </View>

      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: heading }]}>
          {title}
        </Text>

        <Text style={[styles.rowSubtitle, { color: body }]}>
          {subtitle}
        </Text>
      </View>

      <MaterialIcons
        name="chevron-right"
        size={24}
        color={body}
      />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();

  const background = useThemeColor({}, 'background');
  const heading = useThemeColor({}, 'text');
  const body = useThemeColor({}, 'icon');
  const primary = useThemeColor({}, 'primary');

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: background }]}
      edges={['top']}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <MaterialIcons
              name="arrow-back"
              size={24}
              color={heading}
            />
          </Pressable>

          <Text style={[styles.headerTitle, { color: heading }]}>
            Settings
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        {/* Settings */}
        <View style={styles.settingsList}>
          <SettingRow
            icon="person-outline"
            title="Profile Information"
            subtitle="Manage your personal information"
            onPress={() => router.push('/settings/profile')}
          />

          <SettingRow
            icon="menu-book"
            title="Research Settings"
            subtitle="Manage your research preferences"
            onPress={() => router.push('/settings/research-settings')}
          />

          <SettingRow
            icon="auto-awesome"
            title="AI Preferences"
            subtitle="Customize your AI response preferences"
            onPress={() => router.push('/settings/ai-preferences')}
          />

          <SettingRow
            icon="palette"
            title="Appearance"
            subtitle="Choose your theme and font size"
            onPress={() => router.push('/settings/appearance')}
          />

          <SettingRow
            icon="notifications-none"
            title="Notifications"
            subtitle="Manage your notifications"
            onPress={() => router.push('/settings/notifications')}
          />

          <SettingRow
            icon="lock-outline"
            title="Security"
            subtitle="Manage your password and account security"
            onPress={() => router.push('/settings/security')}
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <MaterialIcons
            name="settings"
            size={18}
            color={primary}
          />

          <Text style={[styles.footerText, { color: body }]}>
            MonteSkolar Settings
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  content: {
    paddingBottom: Spacing.xl * 2,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },

  backButton: {
    padding: Spacing.xs,
    width: 40,
  },

  headerSpacer: {
    width: 40,
  },

  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.lg,
    fontWeight: '700',
  },

  settingsList: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },

  row: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.md,
  },

  pressed: {
    opacity: 0.65,
  },

  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },

  rowText: {
    flex: 1,
    paddingRight: Spacing.sm,
  },

  rowTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },

  rowSubtitle: {
    fontSize: FontSize.sm,
    marginTop: 4,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl * 2,
    gap: 6,
  },

  footerText: {
    fontSize: FontSize.sm,
  },
});