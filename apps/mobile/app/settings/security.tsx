import React from 'react';
import {
  Alert,
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

export default function SecuritySettingsScreen() {
  const router = useRouter();

  const background = useThemeColor({}, 'background');
  const heading = useThemeColor({}, 'text');
  const body = useThemeColor({}, 'icon');
  const primary = useThemeColor({}, 'primary');
  const border = useThemeColor({}, 'outline');

  const handleSignOutAllDevices = () => {
    Alert.alert(
      'Sign Out All Devices',
      'Are you sure you want to sign out of all other devices?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            // Connect to authentication service here later.
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: background },
      ]}
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
            style={styles.back}
          >
            <MaterialIcons
              name="arrow-back"
              size={24}
              color={heading}
            />
          </Pressable>

          <Text
            style={[
              styles.headerTitle,
              { color: heading },
            ]}
          >
            Security
          </Text>

          <View style={styles.spacer} />
        </View>

        {/* Security Description */}
        <View
          style={[
            styles.introCard,
            {
              backgroundColor: `${primary}10`,
              borderColor: `${primary}30`,
            },
          ]}
        >
          <MaterialIcons
            name="security"
            size={24}
            color={primary}
          />

          <View style={styles.introText}>
            <Text
              style={[
                styles.introTitle,
                { color: heading },
              ]}
            >
              Account Security
            </Text>

            <Text
              style={[
                styles.introDescription,
                { color: body },
              ]}
            >
              Manage your password, review account activity,
              and control your active sessions.
            </Text>
          </View>
        </View>

        {/* Change Password */}
        <Text
          style={[
            styles.sectionLabel,
            { color: body },
          ]}
        >
          PASSWORD
        </Text>

        <Pressable
          onPress={() =>
            router.push('/settings/change-password')
          }
          style={[
            styles.settingRow,
            { borderColor: border },
          ]}
        >
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: `${primary}12` },
            ]}
          >
            <MaterialIcons
              name="lock-outline"
              size={22}
              color={primary}
            />
          </View>

          <View style={styles.rowText}>
            <Text
              style={[
                styles.rowTitle,
                { color: heading },
              ]}
            >
              Change Password
            </Text>

            <Text
              style={[
                styles.rowDescription,
                { color: body },
              ]}
            >
              Update your MonteSkolar account password
            </Text>
          </View>

          <MaterialIcons
            name="chevron-right"
            size={24}
            color={body}
          />
        </Pressable>

        {/* Login Activity */}
        <Text
          style={[
            styles.sectionLabel,
            { color: body },
          ]}
        >
          LOGIN ACTIVITY
        </Text>

        <View
          style={[
            styles.activityCard,
            { borderColor: border },
          ]}
        >
          {/* Current Device */}
          <View style={styles.activityRow}>
            <View
              style={[
                styles.activityIcon,
                { backgroundColor: `${primary}12` },
              ]}
            >
              <MaterialIcons
                name="phone-android"
                size={21}
                color={primary}
              />
            </View>

            <View style={styles.activityText}>
              <View style={styles.activityTitleRow}>
                <Text
                  style={[
                    styles.activityTitle,
                    { color: heading },
                  ]}
                >
                  Current Device
                </Text>

                <View
                  style={[
                    styles.activeBadge,
                    { backgroundColor: `${primary}18` },
                  ]}
                >
                  <Text
                    style={[
                      styles.activeBadgeText,
                      { color: primary },
                    ]}
                  >
                    Active
                  </Text>
                </View>
              </View>

              <Text
                style={[
                  styles.activityDescription,
                  { color: body },
                ]}
              >
                Android • This device
              </Text>

              <Text
                style={[
                  styles.activityTime,
                  { color: body },
                ]}
              >
                Active now
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.divider,
              { backgroundColor: border },
            ]}
          />

          {/* Previous Login */}
          <View style={styles.activityRow}>
            <View
              style={[
                styles.activityIcon,
                { backgroundColor: `${primary}12` },
              ]}
            >
              <MaterialIcons
                name="computer"
                size={21}
                color={primary}
              />
            </View>

            <View style={styles.activityText}>
              <Text
                style={[
                  styles.activityTitle,
                  { color: heading },
                ]}
              >
                Previous Login
              </Text>

              <Text
                style={[
                  styles.activityDescription,
                  { color: body },
                ]}
              >
                Chrome • Windows
              </Text>

              <Text
                style={[
                  styles.activityTime,
                  { color: body },
                ]}
              >
                Yesterday
              </Text>
            </View>
          </View>
        </View>

        {/* Sign Out All Devices */}
        <Text
          style={[
            styles.sectionLabel,
            { color: body },
          ]}
        >
          ACTIVE SESSIONS
        </Text>

        <Pressable
          onPress={handleSignOutAllDevices}
          style={[
            styles.signOutRow,
            { borderColor: border },
          ]}
        >
          <View style={styles.signOutIcon}>
            <MaterialIcons
              name="logout"
              size={21}
              color="#C62828"
            />
          </View>

          <View style={styles.rowText}>
            <Text style={styles.signOutTitle}>
              Sign Out All Devices
            </Text>

            <Text
              style={[
                styles.rowDescription,
                { color: body },
              ]}
            >
              Sign out of all other active sessions
            </Text>
          </View>

          <MaterialIcons
            name="chevron-right"
            size={24}
            color={body}
          />
        </Pressable>
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

  back: {
    width: 40,
    padding: Spacing.xs,
  },

  spacer: {
    width: 40,
  },

  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.lg,
    fontWeight: '700',
  },

  introCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },

  introText: {
    flex: 1,
    marginLeft: Spacing.sm,
  },

  introTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },

  introDescription: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },

  settingRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },

  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },

  rowText: {
    flex: 1,
  },

  rowTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },

  rowDescription: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },

  activityCard: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },

  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
  },

  activityIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },

  activityText: {
    flex: 1,
  },

  activityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  activityTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },

  activeBadge: {
    marginLeft: Spacing.sm,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },

  activeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },

  activityDescription: {
    fontSize: 11,
    marginTop: 3,
  },

  activityTime: {
    fontSize: 10,
    marginTop: 2,
  },

  divider: {
    height: 1,
    marginLeft: 58,
  },

  signOutRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },

  signOutIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FEECEC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },

  signOutTitle: {
    color: '#C62828',
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});