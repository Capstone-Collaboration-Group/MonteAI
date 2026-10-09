import React, { useCallback, useEffect, useState } from 'react';
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
import { userService } from '@/lib/userService';
import type { UserProfileDto } from '@monteai/types';

const instituteOptions = ['ICS', 'IBE', 'ITE'];

export default function ProfileSettingsScreen() {
  const router = useRouter();

  const background = useThemeColor({}, 'background');
  const heading = useThemeColor({}, 'text');
  const body = useThemeColor({}, 'icon');
  const primary = useThemeColor({}, 'primary');
  const border = useThemeColor({}, 'outline');

  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [middleInitial, setMiddleInitial] = useState('');
  const [lastName, setLastName] = useState('');
  const [studentNo, setStudentNo] = useState('');
  const [institute, setInstitute] = useState('');
  const [showInstituteOptions, setShowInstituteOptions] = useState(false);

  const isStudent = profile?.role === 'Student';
  const showInstitute = profile != null && profile.role !== 'Admin';

  const loadProfile = useCallback(async () => {
    try {
      const me = await userService.getMe();
      if (!me) return;
      setProfile(me);
      setFirstName(me.firstName ?? '');
      setMiddleInitial(me.middleInitial ?? '');
      setLastName(me.lastName ?? '');
      setStudentNo(me.studentNumber ?? '');
      setInstitute(me.institute ?? '');
    } catch {
      // stays null — Save stays disabled
    }
  }, []);

  useEffect(() => {
    let active = true;
    loadProfile().finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [loadProfile]);

  const handleSave = async () => {
    if (!profile) return;

    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Missing name', 'First name and last name are required.');
      return;
    }

    setSaving(true);
    try {
      const updated = await userService.updateMe({
        firstName: firstName.trim(),
        middleInitial: middleInitial.trim(),
        lastName: lastName.trim(),
        ...(isStudent ? { studentNumber: studentNo.trim() } : {}),
        ...(showInstitute && institute ? { institute } : {}),
      });

      if (!updated) {
        Alert.alert('Update failed', 'Your profile could not be updated. Please try again.');
        return;
      }

      setProfile(updated);
      Alert.alert('Profile updated', 'Your changes have been saved.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Update failed', 'Your profile could not be updated. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const initial = (firstName || profile?.firstName || '?').charAt(0).toUpperCase();

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
        keyboardShouldPersistTaps="handled"
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
            Profile Information
          </Text>

          <View style={styles.spacer} />
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color={body} />
          </View>
        ) : (
          <>
            {/* Profile Picture — initial of the first name (no photo upload) */}
            <Text
              style={[
                styles.sectionTitle,
                { color: heading },
              ]}
            >
              Profile Picture
            </Text>

            <View style={styles.photoContainer}>
              <View
                style={[
                  styles.avatar,
                  {
                    backgroundColor: primary,
                  },
                ]}
              >
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
            </View>

            {/* First Name */}
            <Text style={[styles.label, { color: heading }]}>
              First Name
            </Text>

            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              style={[
                styles.input,
                { color: heading, borderColor: border },
              ]}
              placeholder="First Name"
              placeholderTextColor={body}
            />

            {/* Middle Initial */}
            <Text style={[styles.label, { color: heading }]}>
              Middle Initial
            </Text>

            <TextInput
              value={middleInitial}
              onChangeText={(text) => setMiddleInitial(text.slice(0, 1))}
              maxLength={1}
              autoCapitalize="characters"
              style={[
                styles.input,
                { color: heading, borderColor: border },
              ]}
              placeholder="Middle Initial"
              placeholderTextColor={body}
            />

            {/* Last Name */}
            <Text style={[styles.label, { color: heading }]}>
              Last Name
            </Text>

            <TextInput
              value={lastName}
              onChangeText={setLastName}
              style={[
                styles.input,
                { color: heading, borderColor: border },
              ]}
              placeholder="Last Name"
              placeholderTextColor={body}
            />

            {/* Email (read-only: must stay in sync with the sign-in email) */}
            <Text style={[styles.label, { color: heading }]}>
              Email
            </Text>

            <View
              style={[
                styles.input,
                styles.readonlyInput,
                { borderColor: border, backgroundColor: `${body}08` },
              ]}
            >
              <MaterialIcons name="lock-outline" size={16} color={body} />
              <Text
                style={[
                  styles.readonlyText,
                  { color: body },
                ]}
                numberOfLines={1}
              >
                {profile?.email ?? '—'}
              </Text>
            </View>

            <Text style={[styles.hint, { color: body }]}>
              Contact the ICT office to change your email.
            </Text>

            {/* Student Number (students only) */}
            {isStudent && (
              <>
                <Text style={[styles.label, { color: heading }]}>
                  Student No.
                </Text>

                <TextInput
                  value={studentNo}
                  onChangeText={setStudentNo}
                  style={[
                    styles.input,
                    { color: heading, borderColor: border },
                  ]}
                  placeholder="Student Number"
                  placeholderTextColor={body}
                />
              </>
            )}

            {/* Institute */}
            {showInstitute && (
              <>
                <Text style={[styles.label, { color: heading }]}>
                  Institute
                </Text>

                <Pressable
                  onPress={() =>
                    setShowInstituteOptions(!showInstituteOptions)
                  }
                  style={[
                    styles.dropdown,
                    {
                      borderColor: border,
                      backgroundColor: background,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dropdownText,
                      { color: institute ? heading : body },
                    ]}
                  >
                    {institute || 'Select institute'}
                  </Text>

                  <MaterialIcons
                    name={
                      showInstituteOptions
                        ? 'keyboard-arrow-up'
                        : 'keyboard-arrow-down'
                    }
                    size={24}
                    color={body}
                  />
                </Pressable>

                {showInstituteOptions && (
                  <View
                    style={[
                      styles.dropdownOptions,
                      {
                        borderColor: border,
                        backgroundColor: background,
                      },
                    ]}
                  >
                    {instituteOptions.map((option) => (
                      <Pressable
                        key={option}
                        onPress={() => {
                          setInstitute(option);
                          setShowInstituteOptions(false);
                        }}
                        style={[
                          styles.option,
                          { borderBottomColor: border },
                        ]}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            {
                              color:
                                institute === option
                                  ? primary
                                  : heading,
                            },
                          ]}
                        >
                          {option}
                        </Text>

                        {institute === option && (
                          <MaterialIcons
                            name="check"
                            size={20}
                            color={primary}
                          />
                        )}
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* Save */}
            <Pressable
              onPress={handleSave}
              disabled={saving || !profile}
              style={[
                styles.saveButton,
                {
                  backgroundColor: primary,
                  opacity: saving || !profile ? 0.6 : 1,
                },
              ]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveText}>
                  Save Changes
                </Text>
              )}
            </Pressable>
          </>
        )}
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

  loading: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },

  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },

  photoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },

  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    color: '#fff',
    fontSize: FontSize.xxl,
    fontWeight: '700',
  },

  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: Spacing.md,
  },

  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.sm,
  },

  readonlyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },

  readonlyText: {
    flex: 1,
    fontSize: FontSize.sm,
  },

  hint: {
    fontSize: 11,
    marginTop: 4,
  },

  dropdown: {
    height: 44,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  dropdownText: {
    fontSize: FontSize.sm,
  },

  dropdownOptions: {
    borderWidth: 1,
    borderRadius: 6,
    marginTop: 4,
    overflow: 'hidden',
  },

  option: {
    minHeight: 44,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },

  optionText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },

  saveButton: {
    alignSelf: 'flex-end',
    marginTop: Spacing.xl,
    minWidth: 140,
    height: 40,
    paddingHorizontal: Spacing.lg,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },

  saveText: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});
