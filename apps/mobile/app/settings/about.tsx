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

const APP_NAME = 'MonteSkolar';
const VERSION = 'v1.0.0';

const ABOUT_ITEMS = [
  {
    icon: 'school' as const,
    title: 'Institution',
    value: 'Colegio de Montalban',
  },
  {
    icon: 'menu-book' as const,
    title: 'Purpose',
    value: 'Research and thesis repository assistant',
  },
  {
    icon: 'verified-user' as const,
    title: 'Privacy',
    value: 'Your account data is protected and never shared.',
  },
  {
    icon: 'code' as const,
    title: 'Version',
    value: VERSION,
  },
];

export default function AboutScreen() {
  const router = useRouter();

  const background = useThemeColor({}, 'background');
  const heading = useThemeColor({}, 'text');
  const body = useThemeColor({}, 'icon');
  const primary = useThemeColor({}, 'primary');
  const border = useThemeColor({}, 'outline');

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
          <Pressable onPress={() => router.back()} style={styles.back}>
            <MaterialIcons name="arrow-back" size={24} color={heading} />
          </Pressable>

          <Text style={[styles.headerTitle, { color: heading }]}>About</Text>

          <View style={styles.spacer} />
        </View>

        {/* App Identity */}
        <View style={styles.identity}>
          <View style={[styles.logo, { backgroundColor: `${primary}18` }]}>
            <MaterialIcons name="auto-stories" size={44} color={primary} />
          </View>

          <Text style={[styles.appName, { color: heading }]}>{APP_NAME}</Text>
          <Text style={[styles.version, { color: body }]}>{VERSION}</Text>
        </View>

        {/* Description */}
        <Text style={[styles.description, { color: body }]}>
          MonteSkolar is a research and thesis assistant for Colegio de
          Montalban. It helps students and faculty search publications, manage
          research groups, and get AI-assisted answers grounded in the
          institution&apos;s thesis repository.
        </Text>

        {/* Details */}
        <View style={[styles.detailCard, { borderColor: border }]}>
          {ABOUT_ITEMS.map((item, i) => (
            <React.Fragment key={item.title}>
              {i > 0 ? (
                <View style={[styles.divider, { backgroundColor: border }]} />
              ) : null}

              <View style={styles.detailRow}>
                <View
                  style={[
                    styles.detailIcon,
                    { backgroundColor: `${primary}12` },
                  ]}
                >
                  <MaterialIcons name={item.icon} size={20} color={primary} />
                </View>

                <View style={styles.detailText}>
                  <Text style={[styles.detailTitle, { color: heading }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.detailValue, { color: body }]}>
                    {item.value}
                  </Text>
                </View>
              </View>
            </React.Fragment>
          ))}
        </View>

        <Text style={[styles.copyright, { color: body }]}>
          © {new Date().getFullYear()} Colegio de Montalban. All rights
          reserved.
        </Text>
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

  identity: {
    alignItems: 'center',
    marginTop: Spacing.xl,
    gap: 6,
  },

  logo: {
    width: 92,
    height: 92,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },

  appName: {
    fontSize: FontSize.xl,
    fontWeight: '700',
  },

  version: {
    fontSize: FontSize.sm,
  },

  description: {
    fontSize: FontSize.sm,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },

  detailCard: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: Spacing.xl,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
  },

  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },

  detailText: {
    flex: 1,
  },

  detailTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },

  detailValue: {
    fontSize: 11,
    marginTop: 2,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
  },

  copyright: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: Spacing.xl,
    opacity: 0.7,
  },
});
