import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useThemeColor } from '@/hooks/use-theme-color';
import { FontSize, Spacing } from '@/constants/theme';
import { changePassword, describeAuthError } from '@/lib/authService';

export default function ChangePasswordScreen() {
  const router = useRouter();

  const background = useThemeColor({}, 'background');
  const heading = useThemeColor({}, 'text');
  const body = useThemeColor({}, 'icon');
  const primary = useThemeColor({}, 'primary');
  const border = useThemeColor({}, 'outline');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleUpdate = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Missing fields', 'Fill in all three password fields.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Password too short', 'New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords do not match', 'New password and confirmation must match.');
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      Alert.alert('Password updated', 'Your password has been changed successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      const code = (err as { code?: string } | null)?.code ?? '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        Alert.alert('Incorrect password', 'Your current password is incorrect.');
      } else if (code === 'auth/requires-recent-login') {
        Alert.alert('Session expired', 'Please sign out and sign in again, then retry.');
      } else {
        Alert.alert('Update failed', describeAuthError(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

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
            Change Password
          </Text>

          <View style={styles.spacer} />
        </View>

        {/* Intro */}
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
            name="lock-outline"
            size={24}
            color={primary}
          />

          <View style={styles.introText}>
            <Text style={[styles.introTitle, { color: heading }]}>
              Update Your Password
            </Text>

            <Text style={[styles.introDescription, { color: body }]}>
              Create a new password to keep your MonteSkolar account secure.
            </Text>
          </View>
        </View>

        {/* Current Password */}
        <Text style={[styles.label, { color: heading }]}>
          Current Password
        </Text>

        <View
          style={[
            styles.inputContainer,
            {
              borderColor: border,
              backgroundColor: background,
            },
          ]}
        >
          <MaterialIcons
            name="lock-outline"
            size={21}
            color={body}
          />

          <TextInput
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Enter current password"
            placeholderTextColor={body}
            secureTextEntry={!showCurrent}
            style={[styles.input, { color: heading }]}
          />

          <Pressable onPress={() => setShowCurrent(!showCurrent)}>
            <MaterialIcons
              name={showCurrent ? 'visibility' : 'visibility-off'}
              size={21}
              color={body}
            />
          </Pressable>
        </View>

        {/* New Password */}
        <Text style={[styles.label, { color: heading }]}>
          New Password
        </Text>

        <View
          style={[
            styles.inputContainer,
            {
              borderColor: border,
              backgroundColor: background,
            },
          ]}
        >
          <MaterialIcons
            name="lock-outline"
            size={21}
            color={body}
          />

          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Enter new password"
            placeholderTextColor={body}
            secureTextEntry={!showNew}
            style={[styles.input, { color: heading }]}
          />

          <Pressable onPress={() => setShowNew(!showNew)}>
            <MaterialIcons
              name={showNew ? 'visibility' : 'visibility-off'}
              size={21}
              color={body}
            />
          </Pressable>
        </View>

        {/* Confirm Password */}
        <Text style={[styles.label, { color: heading }]}>
          Confirm New Password
        </Text>

        <View
          style={[
            styles.inputContainer,
            {
              borderColor: border,
              backgroundColor: background,
            },
          ]}
        >
          <MaterialIcons
            name="lock-outline"
            size={21}
            color={body}
          />

          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            placeholderTextColor={body}
            secureTextEntry={!showConfirm}
            style={[styles.input, { color: heading }]}
          />

          <Pressable onPress={() => setShowConfirm(!showConfirm)}>
            <MaterialIcons
              name={showConfirm ? 'visibility' : 'visibility-off'}
              size={21}
              color={body}
            />
          </Pressable>
        </View>

        {/* Password Requirements */}
        <View
          style={[
            styles.requirementsCard,
            {
              borderColor: border,
              backgroundColor: `${primary}06`,
            },
          ]}
        >
          <View style={styles.requirementHeader}>
            <MaterialIcons
              name="info-outline"
              size={20}
              color={primary}
            />

            <Text
              style={[
                styles.requirementTitle,
                { color: heading },
              ]}
            >
              Password Requirements
            </Text>
          </View>

          <Text style={[styles.requirementText, { color: body }]}>
            • Use a strong password that you do not use elsewhere.
          </Text>

          <Text style={[styles.requirementText, { color: body }]}>
            • Make sure your new password and confirmation match.
          </Text>
        </View>

        {/* Update Button */}
        <Pressable
          style={[
            styles.updateButton,
            { backgroundColor: primary, opacity: submitting ? 0.7 : 1 },
          ]}
          onPress={handleUpdate}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialIcons
                name="lock-reset"
                size={21}
                color="#FFFFFF"
              />

              <Text style={styles.updateButtonText}>
                Update Password
              </Text>
            </>
          )}
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
    marginBottom: Spacing.lg,
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

  spacer: {
    width: 40,
  },

  introCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
  },

  introText: {
    flex: 1,
    marginLeft: Spacing.sm,
  },

  introTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginBottom: 4,
  },

  introDescription: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },

  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },

  inputContainer: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
  },

  input: {
    flex: 1,
    fontSize: FontSize.md,
    marginHorizontal: Spacing.sm,
    paddingVertical: 0,
  },

  requirementsCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.md,
    marginTop: Spacing.xl,
  },

  requirementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },

  requirementTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    marginLeft: Spacing.xs,
  },

  requirementText: {
    fontSize: FontSize.sm,
    lineHeight: 21,
    marginTop: 4,
  },

  updateButton: {
    minHeight: 52,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },

  updateButtonText: {
    color: '#FFFFFF',
    fontSize: FontSize.md,
    fontWeight: '700',
    marginLeft: Spacing.xs,
  },
});