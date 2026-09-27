import React, { useState } from 'react';
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

const fontSizes = ['Small', 'Medium', 'Large'];

export default function AppearanceScreen() {
  const router = useRouter();

  const background = useThemeColor({}, 'background');
  const heading = useThemeColor({}, 'text');
  const body = useThemeColor({}, 'icon');
  const primary = useThemeColor({}, 'primary');

  const [theme, setTheme] = useState<'Light' | 'Dark'>('Light');
  const [fontSize, setFontSize] = useState('Medium');

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: background }]}
      edges={['top']}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back}>
            <MaterialIcons
              name="arrow-back"
              size={24}
              color={heading}
            />
          </Pressable>

          <Text style={[styles.headerTitle, { color: heading }]}>
            Appearance
          </Text>

          <View style={styles.spacer} />
        </View>

        <Text style={[styles.sectionTitle, { color: heading }]}>
          Theme
        </Text>

        <View style={styles.themeRow}>
          <Pressable
            onPress={() => setTheme('Light')}
            style={[
              styles.themeCard,
              {
                borderColor:
                  theme === 'Light' ? primary : '#ccc',
                backgroundColor: '#fff',
              },
            ]}
          >
            <MaterialIcons
              name="light-mode"
              size={28}
              color={theme === 'Light' ? primary : '#555'}
            />

            <Text
              style={[
                styles.themeText,
                {
                  color:
                    theme === 'Light' ? primary : '#111',
                },
              ]}
            >
              Light
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setTheme('Dark')}
            style={[
              styles.themeCard,
              {
                borderColor:
                  theme === 'Dark' ? primary : '#ccc',
                backgroundColor: '#111',
              },
            ]}
          >
            <MaterialIcons
              name="dark-mode"
              size={28}
              color="#fff"
            />

            <Text style={[styles.themeText, { color: '#fff' }]}>
              Dark
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, { color: heading }]}>
          Font Size
        </Text>

        {fontSizes.map((option) => (
          <Pressable
            key={option}
            onPress={() => setFontSize(option)}
            style={styles.radioRow}
          >
            <MaterialIcons
              name={
                fontSize === option
                  ? 'radio-button-checked'
                  : 'radio-button-unchecked'
              }
              size={20}
              color={fontSize === option ? primary : body}
            />

            <Text style={[styles.optionText, { color: heading }]}>
              {option}
            </Text>
          </Pressable>
        ))}

        <Pressable
          onPress={() => router.back()}
          style={[styles.saveButton, { backgroundColor: primary }]}
        >
          <Text style={styles.saveText}>Save Changes</Text>
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
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },

  themeRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },

  themeCard: {
    flex: 1,
    height: 120,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },

  themeText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },

  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },

  optionText: {
    fontSize: FontSize.sm,
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