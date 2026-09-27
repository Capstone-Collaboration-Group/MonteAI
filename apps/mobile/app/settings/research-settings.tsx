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

const citationOptions = [
  'APA 7th edition',
  'MLA 9th edition',
  'Chicago 17th edition',
  'IEEE',
  'Harvard',
  'Vancouver',
];

const languageOptions = [
  'English',
  'Filipino',
  'Spanish',
];

const yearOptions = [
  'Any Time',
  'Last 3 years',
  'Last 5 years',
  'Custom Range',
];

const currentYear = new Date().getFullYear();

const yearList = Array.from(
  { length: currentYear - 1999 },
  (_, index) => currentYear - index
);

export default function ResearchSettingsScreen() {
  const router = useRouter();

  const background = useThemeColor({}, 'background');
  const heading = useThemeColor({}, 'text');
  const body = useThemeColor({}, 'icon');
  const primary = useThemeColor({}, 'primary');
  const border = useThemeColor({}, 'outline');

  const [citation, setCitation] = useState('APA 7th edition');
  const [language, setLanguage] = useState('English');
  const [yearRange, setYearRange] = useState('Last 3 years');

  const [startYear, setStartYear] = useState(currentYear - 5);
  const [endYear, setEndYear] = useState(currentYear);

  const [showStartYears, setShowStartYears] = useState(false);
  const [showEndYears, setShowEndYears] = useState(false);

  const getYearDescription = () => {
    if (yearRange === 'Any Time') {
      return 'Research results can include studies from any publication year.';
    }

    if (yearRange === 'Last 3 years') {
      return 'Research results will prioritize studies from the latest three years.';
    }

    if (yearRange === 'Last 5 years') {
      return 'Research results will prioritize studies from the latest five years.';
    }

    return `Research results will include studies published from ${startYear} to ${endYear}.`;
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
            Research Settings
          </Text>

          <View style={styles.spacer} />
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: heading }]}>
          Research Preferences
        </Text>

        {/* Citation Style */}
        <Text style={[styles.label, { color: heading }]}>
          Default Citation Style
        </Text>

        <View
          style={[
            styles.options,
            { borderColor: border },
          ]}
        >
          {citationOptions.map((option) => (
            <Pressable
              key={option}
              onPress={() => setCitation(option)}
              style={styles.option}
            >
              <MaterialIcons
                name={
                  citation === option
                    ? 'radio-button-checked'
                    : 'radio-button-unchecked'
                }
                size={20}
                color={
                  citation === option
                    ? primary
                    : body
                }
              />

              <Text
                style={[
                  styles.optionText,
                  { color: heading },
                ]}
              >
                {option}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Language */}
        <Text style={[styles.label, { color: heading }]}>
          Preferred Language
        </Text>

        <View
          style={[
            styles.options,
            { borderColor: border },
          ]}
        >
          {languageOptions.map((option) => (
            <Pressable
              key={option}
              onPress={() => setLanguage(option)}
              style={styles.option}
            >
              <MaterialIcons
                name={
                  language === option
                    ? 'radio-button-checked'
                    : 'radio-button-unchecked'
                }
                size={20}
                color={
                  language === option
                    ? primary
                    : body
                }
              />

              <Text
                style={[
                  styles.optionText,
                  { color: heading },
                ]}
              >
                {option}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Default Repository */}
        <Text style={[styles.label, { color: heading }]}>
          Default Repository
        </Text>

        <View
          style={[
            styles.repositoryBox,
            {
              borderColor: border,
              backgroundColor: `${primary}10`,
            },
          ]}
        >
          <MaterialIcons
            name="folder"
            size={22}
            color={primary}
          />

          <View style={styles.repositoryText}>
            <Text
              style={[
                styles.repositoryTitle,
                { color: heading },
              ]}
            >
              MonteSkolar Repository
            </Text>

            <Text
              style={[
                styles.repositorySubtitle,
                { color: body },
              ]}
            >
              Colegio de Montalban thesis and research repository
            </Text>
          </View>

          <MaterialIcons
            name="lock"
            size={18}
            color={body}
          />
        </View>

        {/* Publication Year Range */}
        <Text style={[styles.label, { color: heading }]}>
          Publication Year Range
        </Text>

        <View
          style={[
            styles.options,
            { borderColor: border },
          ]}
        >
          {yearOptions.map((option) => (
            <Pressable
              key={option}
              onPress={() => setYearRange(option)}
              style={styles.option}
            >
              <MaterialIcons
                name={
                  yearRange === option
                    ? 'radio-button-checked'
                    : 'radio-button-unchecked'
                }
                size={20}
                color={
                  yearRange === option
                    ? primary
                    : body
                }
              />

              <Text
                style={[
                  styles.optionText,
                  { color: heading },
                ]}
              >
                {option}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Custom Year Range */}
        {yearRange === 'Custom Range' && (
          <View style={styles.customRange}>
            <Text
              style={[
                styles.customLabel,
                { color: heading },
              ]}
            >
              Select publication range
            </Text>

            <View style={styles.yearRow}>
              {/* Start Year */}
              <View style={styles.yearContainer}>
                <Text
                  style={[
                    styles.yearLabel,
                    { color: body },
                  ]}
                >
                  From
                </Text>

                <Pressable
                  onPress={() => {
                    setShowStartYears(!showStartYears);
                    setShowEndYears(false);
                  }}
                  style={[
                    styles.yearSelector,
                    { borderColor: border },
                  ]}
                >
                  <Text
                    style={[
                      styles.yearText,
                      { color: heading },
                    ]}
                  >
                    {startYear}
                  </Text>

                  <MaterialIcons
                    name="keyboard-arrow-down"
                    size={20}
                    color={body}
                  />
                </Pressable>

                {showStartYears && (
                  <View
                    style={[
                      styles.yearDropdown,
                      {
                        backgroundColor: background,
                        borderColor: border,
                      },
                    ]}
                  >
                    <ScrollView
                      nestedScrollEnabled
                      style={styles.yearScroll}
                      showsVerticalScrollIndicator={false}
                    >
                      {yearList.map((year) => (
                        <Pressable
                          key={year}
                          onPress={() => {
                            setStartYear(year);
                            setShowStartYears(false);

                            if (year > endYear) {
                              setEndYear(year);
                            }
                          }}
                          style={[
                            styles.yearItem,
                            year === startYear && {
                              backgroundColor: `${primary}18`,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.yearItemText,
                              { color: heading },
                            ]}
                          >
                            {year}
                          </Text>

                          {year === startYear && (
                            <MaterialIcons
                              name="check"
                              size={18}
                              color={primary}
                            />
                          )}
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <Text
                style={[
                  styles.toText,
                  { color: body },
                ]}
              >
                to
              </Text>

              {/* End Year */}
              <View style={styles.yearContainer}>
                <Text
                  style={[
                    styles.yearLabel,
                    { color: body },
                  ]}
                >
                  To
                </Text>

                <Pressable
                  onPress={() => {
                    setShowEndYears(!showEndYears);
                    setShowStartYears(false);
                  }}
                  style={[
                    styles.yearSelector,
                    { borderColor: border },
                  ]}
                >
                  <Text
                    style={[
                      styles.yearText,
                      { color: heading },
                    ]}
                  >
                    {endYear}
                  </Text>

                  <MaterialIcons
                    name="keyboard-arrow-down"
                    size={20}
                    color={body}
                  />
                </Pressable>

                {showEndYears && (
                  <View
                    style={[
                      styles.yearDropdown,
                      {
                        backgroundColor: background,
                        borderColor: border,
                      },
                    ]}
                  >
                    <ScrollView
                      nestedScrollEnabled
                      style={styles.yearScroll}
                      showsVerticalScrollIndicator={false}
                    >
                      {yearList
                        .filter((year) => year >= startYear)
                        .map((year) => (
                          <Pressable
                            key={year}
                            onPress={() => {
                              setEndYear(year);
                              setShowEndYears(false);
                            }}
                            style={[
                              styles.yearItem,
                              year === endYear && {
                                backgroundColor: `${primary}18`,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.yearItemText,
                                { color: heading },
                              ]}
                            >
                              {year}
                            </Text>

                            {year === endYear && (
                              <MaterialIcons
                                name="check"
                                size={18}
                                color={primary}
                              />
                            )}
                          </Pressable>
                        ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Year Range Information */}
        <View
          style={[
            styles.info,
            { backgroundColor: `${primary}18` },
          ]}
        >
          <MaterialIcons
            name="info-outline"
            size={18}
            color={primary}
          />

          <Text
            style={[
              styles.infoText,
              { color: heading },
            ]}
          >
            {getYearDescription()}
          </Text>
        </View>

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

  title: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginTop: Spacing.lg,
  },

  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },

  options: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 4,
  },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },

  optionText: {
    fontSize: FontSize.sm,
  },

  repositoryBox: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },

  repositoryText: {
    flex: 1,
  },

  repositoryTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },

  repositorySubtitle: {
    fontSize: 10,
    marginTop: 3,
  },

  customRange: {
    marginTop: Spacing.md,
  },

  customLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },

  yearRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },

  yearContainer: {
    flex: 1,
    position: 'relative',
  },

  yearLabel: {
    fontSize: 11,
    marginBottom: 4,
  },

  yearSelector: {
    height: 44,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  yearText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },

  toText: {
    fontSize: FontSize.sm,
    marginBottom: 12,
  },

  yearDropdown: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 65,
    borderWidth: 1,
    borderRadius: 6,
    zIndex: 10,
    elevation: 5,
    overflow: 'hidden',
  },

  yearScroll: {
    maxHeight: 180,
  },

  yearItem: {
    minHeight: 40,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  yearItemText: {
    fontSize: FontSize.sm,
  },

  info: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: Spacing.sm,
    borderRadius: 6,
    marginTop: Spacing.md,
  },

  infoText: {
    flex: 1,
    fontSize: 11,
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