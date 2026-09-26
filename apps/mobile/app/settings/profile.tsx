import React, { useState } from 'react';
import {
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

const instituteOptions = ['ICS', 'IBE', 'ITE'];

export default function ProfileSettingsScreen() {
  const router = useRouter();

  const background = useThemeColor({}, 'background');
  const heading = useThemeColor({}, 'text');
  const body = useThemeColor({}, 'icon');
  const primary = useThemeColor({}, 'primary');
  const border = useThemeColor({}, 'outline');

  const [name, setName] = useState('Miu Ichika');
  const [email, setEmail] = useState('miu.ichika@student.edu.ph');
  const [studentNo, setStudentNo] = useState('00-0000');
  const [institute, setInstitute] = useState('ICS');
  const [showInstituteOptions, setShowInstituteOptions] = useState(false);

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
            Profile Information
          </Text>

          <View style={styles.spacer} />
        </View>

        {/* Profile Picture */}
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
                backgroundColor: `${primary}22`,
              },
            ]}
          >
            <MaterialIcons
              name="person"
              size={58}
              color={primary}
            />
          </View>

          <Pressable
            onPress={() =>
              router.push('/settings/change-photo')
            }
            style={[
              styles.photoButton,
              { borderColor: primary },
            ]}
          >
            <Text
              style={[
                styles.photoButtonText,
                { color: primary },
              ]}
            >
              Change Photo
            </Text>
          </Pressable>
        </View>

        {/* Full Name */}
        <Text
          style={[
            styles.label,
            { color: heading },
          ]}
        >
          Full Name
        </Text>

        <TextInput
          value={name}
          onChangeText={setName}
          style={[
            styles.input,
            {
              color: heading,
              borderColor: border,
            },
          ]}
          placeholder="Full Name"
          placeholderTextColor={body}
        />

        {/* Email */}
        <Text
          style={[
            styles.label,
            { color: heading },
          ]}
        >
          Email
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          style={[
            styles.input,
            {
              color: heading,
              borderColor: border,
            },
          ]}
          placeholder="Email"
          placeholderTextColor={body}
        />

        {/* Student Number */}
        <Text
          style={[
            styles.label,
            { color: heading },
          ]}
        >
          Student No.
        </Text>

        <TextInput
          value={studentNo}
          onChangeText={setStudentNo}
          style={[
            styles.input,
            {
              color: heading,
              borderColor: border,
            },
          ]}
          placeholder="Student Number"
          placeholderTextColor={body}
        />

        {/* Institute */}
        <Text
          style={[
            styles.label,
            { color: heading },
          ]}
        >
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
              { color: heading },
            ]}
          >
            {institute}
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

        {/* Institute Options */}
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
                  {
                    borderBottomColor: border,
                  },
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

        {/* Save */}
        <Pressable
          onPress={() => router.back()}
          style={[
            styles.saveButton,
            { backgroundColor: primary },
          ]}
        >
          <Text style={styles.saveText}>
            Save Changes
          </Text>
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
    marginBottom: Spacing.md,
  },

  photoButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },

  photoButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 6,
  },

  saveText: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});