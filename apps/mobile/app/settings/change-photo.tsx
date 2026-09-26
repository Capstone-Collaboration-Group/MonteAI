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

export default function ChangePhotoScreen() {
  const router = useRouter();

  const background = useThemeColor({}, 'background');
  const heading = useThemeColor({}, 'text');
  const body = useThemeColor({}, 'icon');
  const primary = useThemeColor({}, 'primary');
  const border = useThemeColor({}, 'outline');

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
            Change Photo
          </Text>

          <View style={styles.spacer} />
        </View>

        {/* Title */}
        <Text
          style={[
            styles.title,
            { color: heading },
          ]}
        >
          Profile Picture
        </Text>

        <Text
          style={[
            styles.description,
            { color: body },
          ]}
        >
          Choose a new profile picture for your account.
        </Text>

        {/* Upload Area */}
        <Pressable
          style={[
            styles.uploadArea,
            {
              borderColor: border,
              backgroundColor: `${primary}08`,
            },
          ]}
        >
          <View
            style={[
              styles.uploadIcon,
              {
                backgroundColor: `${primary}18`,
              },
            ]}
          >
            <MaterialIcons
              name="cloud-upload"
              size={42}
              color={primary}
            />
          </View>

          <Text
            style={[
              styles.uploadTitle,
              { color: heading },
            ]}
          >
            Drag image here or browse
          </Text>

          <Text
            style={[
              styles.uploadDescription,
              { color: body },
            ]}
          >
            Select an image from your device
          </Text>

          <View
            style={[
              styles.browseButton,
              { backgroundColor: primary },
            ]}
          >
            <MaterialIcons
              name="folder-open"
              size={18}
              color="#fff"
            />

            <Text style={styles.browseText}>
              Browse
            </Text>
          </View>
        </Pressable>

        {/* Cancel */}
        <Pressable
          onPress={() => router.back()}
          style={[
            styles.cancelButton,
            { borderColor: border },
          ]}
        >
          <Text
            style={[
              styles.cancelText,
              { color: heading },
            ]}
          >
            Cancel
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

  title: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginTop: Spacing.xl,
  },

  description: {
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },

  uploadArea: {
    minHeight: 260,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },

  uploadIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },

  uploadTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    textAlign: 'center',
  },

  uploadDescription: {
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },

  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 6,
  },

  browseText: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: '700',
  },

  cancelButton: {
    alignSelf: 'center',
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
  },

  cancelText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});