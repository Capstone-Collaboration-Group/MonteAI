import React, { useEffect, useState } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useThemeColor } from '@/hooks/use-theme-color';
import { FontSize, Spacing } from '@/constants/theme';

const fontSizes = ['Small', 'Medium', 'Large'];

export const FONT_SIZE_STORAGE_KEY = 'monteai.settings.fontSize';

export default function AppearanceScreen() {
  const router = useRouter();

  const background = useThemeColor({}, 'background');
  const heading = useThemeColor({}, 'text');
  const body = useThemeColor({}, 'icon');
  const primary = useThemeColor({}, 'primary');

  const [fontSize, setFontSize] = useState('Medium');

  useEffect(() => {
    AsyncStorage.getItem(FONT_SIZE_STORAGE_KEY)
      .then((stored) => {
        if (stored && fontSizes.includes(stored)) setFontSize(stored);
      })
      .catch(() => {
        // keep default
      });
  }, []);

  const selectFontSize = (option: string) => {
    setFontSize(option);
    AsyncStorage.setItem(FONT_SIZE_STORAGE_KEY, option).catch(() => {
      // preference is best-effort — next launch retries
    });
  };

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
          Font Size
        </Text>

        {fontSizes.map((option) => (
          <Pressable
            key={option}
            onPress={() => selectFontSize(option)}
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

  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },

  optionText: {
    fontSize: FontSize.sm,
  },
});
