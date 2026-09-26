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

const responseStyles = [
  {
    title: 'Academic',
    subtitle: 'Formal and scholarly',
  },
  {
    title: 'Simple',
    subtitle: 'Easy to understand',
  },
  {
    title: 'Detailed',
    subtitle: 'More comprehensive explanation',
  },
];

const responseLengths = ['Short', 'Medium', 'Long'];

export default function AIPreferencesScreen() {
  const router = useRouter();

  const background = useThemeColor({}, 'background');
  const heading = useThemeColor({}, 'text');
  const body = useThemeColor({}, 'icon');
  const primary = useThemeColor({}, 'primary');

  const [responseStyle, setResponseStyle] = useState('Academic');
  const [responseLength, setResponseLength] = useState('Medium');

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
            AI Preferences
          </Text>

          <View style={styles.spacer} />
        </View>

        <Text style={[styles.sectionTitle, { color: heading }]}>
          Response Style
        </Text>

        <Text style={[styles.description, { color: body }]}>
          Choose the tone and style of AI responses
        </Text>

        {responseStyles.map((option) => (
          <Pressable
            key={option.title}
            onPress={() => setResponseStyle(option.title)}
            style={styles.radioRow}
          >
            <MaterialIcons
              name={
                responseStyle === option.title
                  ? 'radio-button-checked'
                  : 'radio-button-unchecked'
              }
              size={20}
              color={responseStyle === option.title ? primary : body}
            />

            <View>
              <Text style={[styles.optionTitle, { color: heading }]}>
                {option.title}
              </Text>

              <Text style={[styles.optionSubtitle, { color: body }]}>
                {option.subtitle}
              </Text>
            </View>
          </Pressable>
        ))}

        <Text style={[styles.sectionTitle, { color: heading }]}>
          Response Length
        </Text>

        {responseLengths.map((option) => (
          <Pressable
            key={option}
            onPress={() => setResponseLength(option)}
            style={styles.radioRow}
          >
            <MaterialIcons
              name={
                responseLength === option
                  ? 'radio-button-checked'
                  : 'radio-button-unchecked'
              }
              size={20}
              color={responseLength === option ? primary : body}
            />

            <Text style={[styles.optionTitle, { color: heading }]}>
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
  },

  description: {
    fontSize: 11,
    marginTop: 3,
    marginBottom: Spacing.md,
  },

  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },

  optionTitle: {
    fontSize: FontSize.sm,
  },

  optionSubtitle: {
    fontSize: 10,
    marginTop: 1,
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