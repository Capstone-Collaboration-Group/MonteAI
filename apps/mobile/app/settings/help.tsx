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

const faqs = [
  {
    question: 'How do I search for a thesis?',
    answer:
      'Open the Library tab and use the search bar to look for titles, authors, or keywords. You can also filter by program or publication year.',
  },
  {
    question: 'How do I join a research group?',
    answer:
      'Go to the Research Group tab and send a request to an existing group, or create a new group and invite your members by student number.',
  },
  {
    question: 'How do I change my password?',
    answer:
      'Go to Profile → Change Password (Security), enter your current password and your new password, then tap Update Password.',
  },
  {
    question: 'Why did I not receive an email verification?',
    answer:
      'Check your spam folder first. You can also resend the verification email from the sign-up flow if your account is still unverified.',
  },
  {
    question: 'Who can I contact for technical support?',
    answer:
      'Email the MIS office at support@pnm.edu.ph or visit the ICT office at Colegio de Montalban during office hours.',
  },
];

export default function HelpSupportScreen() {
  const router = useRouter();

  const background = useThemeColor({}, 'background');
  const heading = useThemeColor({}, 'text');
  const body = useThemeColor({}, 'icon');
  const primary = useThemeColor({}, 'primary');
  const border = useThemeColor({}, 'outline');

  const [expanded, setExpanded] = useState<number | null>(null);

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

          <Text style={[styles.headerTitle, { color: heading }]}>
            Help &amp; Support
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
          <MaterialIcons name="help-outline" size={24} color={primary} />

          <View style={styles.introText}>
            <Text style={[styles.introTitle, { color: heading }]}>
              How can we help?
            </Text>

            <Text style={[styles.introDescription, { color: body }]}>
              Find answers to common questions about MonteSkolar, or reach out
              to our support team.
            </Text>
          </View>
        </View>

        {/* FAQ */}
        <Text style={[styles.sectionLabel, { color: body }]}>
          FREQUENTLY ASKED QUESTIONS
        </Text>

        <View style={[styles.faqCard, { borderColor: border }]}>
          {faqs.map((faq, i) => (
            <React.Fragment key={faq.question}>
              {i > 0 ? (
                <View style={[styles.divider, { backgroundColor: border }]} />
              ) : null}

              <Pressable
                style={styles.faqRow}
                onPress={() => setExpanded(expanded === i ? null : i)}
              >
                <View style={styles.faqText}>
                  <Text style={[styles.faqQuestion, { color: heading }]}>
                    {faq.question}
                  </Text>

                  {expanded === i && (
                    <Text style={[styles.faqAnswer, { color: body }]}>
                      {faq.answer}
                    </Text>
                  )}
                </View>

                <MaterialIcons
                  name={expanded === i ? 'expand-less' : 'expand-more'}
                  size={22}
                  color={body}
                />
              </Pressable>
            </React.Fragment>
          ))}
        </View>

        {/* Contact */}
        <Text style={[styles.sectionLabel, { color: body }]}>CONTACT US</Text>

        <View style={[styles.contactCard, { borderColor: border }]}>
          <View style={styles.contactRow}>
            <View
              style={[styles.contactIcon, { backgroundColor: `${primary}12` }]}
            >
              <MaterialIcons name="email" size={20} color={primary} />
            </View>

            <View style={styles.contactText}>
              <Text style={[styles.contactTitle, { color: heading }]}>
                Email
              </Text>
              <Text style={[styles.contactValue, { color: body }]}>
                support@pnm.edu.ph
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: border }]} />

          <View style={styles.contactRow}>
            <View
              style={[styles.contactIcon, { backgroundColor: `${primary}12` }]}
            >
              <MaterialIcons name="location-on" size={20} color={primary} />
            </View>

            <View style={styles.contactText}>
              <Text style={[styles.contactTitle, { color: heading }]}>
                Office
              </Text>
              <Text style={[styles.contactValue, { color: body }]}>
                ICT Office, Colegio de Montalban
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: border }]} />

          <View style={styles.contactRow}>
            <View
              style={[styles.contactIcon, { backgroundColor: `${primary}12` }]}
            >
              <MaterialIcons name="schedule" size={20} color={primary} />
            </View>

            <View style={styles.contactText}>
              <Text style={[styles.contactTitle, { color: heading }]}>
                Office Hours
              </Text>
              <Text style={[styles.contactValue, { color: body }]}>
                Monday to Friday, 8:00 AM – 5:00 PM
              </Text>
            </View>
          </View>
        </View>
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
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.md,
    marginTop: Spacing.lg,
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

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },

  faqCard: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },

  faqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },

  faqText: {
    flex: 1,
    paddingRight: Spacing.sm,
  },

  faqQuestion: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },

  faqAnswer: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginTop: 6,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
  },

  contactCard: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },

  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
  },

  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },

  contactText: {
    flex: 1,
  },

  contactTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },

  contactValue: {
    fontSize: 11,
    marginTop: 2,
  },
});
