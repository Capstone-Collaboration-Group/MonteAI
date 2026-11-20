import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { PRIVACY_NOTICE_VERSION, TERMS_AND_CONDITIONS_VERSION } from '@monteai/types';

import { Text } from '@/components/ui/ScaledText';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useThemeColor } from '@/hooks/use-theme-color';
import { FontSize, Radius, Spacing } from '@/constants/theme';

interface Props {
  privacyAccepted: boolean;
  termsAccepted: boolean;
  onPrivacyChange: (accepted: boolean) => void;
  onTermsChange: (accepted: boolean) => void;
  disabled?: boolean;
}

// Native presentation of the existing account notices; policy versions and the
// faculty rule are unchanged. Opening/dismissing a notice is NOT acceptance.
export default function SignupConsent({ privacyAccepted, termsAccepted, onPrivacyChange, onTermsChange, disabled }: Props) {
  const [notice, setNotice] = useState<'privacy' | 'terms' | null>(null);
  const background = useThemeColor({}, 'background');
  const heading = useThemeColor({}, 'onSurface');
  const body = useThemeColor({}, 'onSurfaceVariant');
  const primary = useThemeColor({}, 'primary');
  const outline = useThemeColor({}, 'outlineVariant');

  return <View style={s.group}>
    {([
      { key: 'privacy' as const, title: 'Privacy notice', version: PRIVACY_NOTICE_VERSION, accepted: privacyAccepted, change: onPrivacyChange },
      { key: 'terms' as const, title: 'Terms and conditions', version: TERMS_AND_CONDITIONS_VERSION, accepted: termsAccepted, change: onTermsChange },
    ]).map(item => <View key={item.key} style={[s.row, { borderColor: outline }]}>
      <Pressable accessibilityRole="checkbox" accessibilityLabel={`I have read and agree to the ${item.title.toLowerCase()}`}
        accessibilityState={{ checked: item.accepted, disabled: !!disabled }} disabled={disabled}
        onPress={() => item.accepted ? item.change(false) : setNotice(item.key)} style={s.check}>
        <MaterialIcons name={item.accepted ? 'check-box' : 'check-box-outline-blank'} size={26} color={primary} />
      </Pressable>
      <View style={s.flex}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Read ${item.title.toLowerCase()}`} disabled={disabled} onPress={() => setNotice(item.key)}>
          <Text style={[s.link, { color: primary }]}>{item.title}</Text>
        </Pressable>
        <Text style={[s.small, { color: body }]}>{item.accepted ? 'Accepted' : 'Required'} · Version {item.version}</Text>
      </View>
    </View>)}

    <Modal visible={notice !== null} animationType="slide" onRequestClose={() => setNotice(null)}>
      <SafeAreaView style={[s.modal, { backgroundColor: background }]}>
        <Text accessibilityRole="header" style={[s.title, { color: heading }]}>{notice === 'privacy' ? 'Privacy notice' : 'Terms and conditions'}</Text>
        <ScrollView contentContainerStyle={s.notice}>
          <Text style={[s.small, { color: body }]}>Version {notice === 'privacy' ? PRIVACY_NOTICE_VERSION : TERMS_AND_CONDITIONS_VERSION}</Text>
          {notice === 'privacy' ? <>
            <Text style={[s.paragraph, { color: body }]}>Republic Act No. 10173 (Data Privacy Act of 2012)</Text>
            <Text style={[s.paragraph, { color: body }]}>MonteAI processes information to manage your account and provide institutional thesis discovery and research assistance:</Text>
            <Text style={[s.paragraph, { color: body }]}>• Account information, including your name, account email, student number, institute, program, year, and section, is stored in account records to create and manage your account.</Text>
            <Text style={[s.paragraph, { color: body }]}>• Thesis PDFs and metadata, including title, author names, abstract, and publication year. PDFs are stored in Azure Blob Storage; approved metadata is stored in MonteAI’s database and indexed for search. Relevant metadata may be retrieved for chat answers and citations.</Text>
            <Text style={[s.paragraph, { color: body }]}>• Chat messages are stored and used to process your questions, retrieve relevant thesis metadata, and generate responses.</Text>
            <Text style={[s.paragraph, { color: body }]}>• A TOTP secret is stored in encrypted form when you enable authenticator-based two-factor authentication.</Text>
            <Text style={[s.paragraph, { color: body }]}>Authentication uses Firebase. Account and thesis records are stored in Azure SQL, thesis PDFs in Azure Blob Storage, and thesis abstracts and related data in Firestore. Pinecone searches thesis metadata; Azure AI services generate chat responses.</Text>
            <Text style={[s.paragraph, { color: body }]}>Thesis PDFs are available to students in view-only mode; student downloads are not offered. Theses are included only after research department approval and the authors’ separate formal consent. This account notice does not replace manuscript consent. MonteAI provides access and discovery and does not claim ownership of thesis works.</Text>
            <Text style={[s.paragraph, { color: body }]}>Android signup also asks for a live capture of the front of your student ID. The capture is processed in memory and sent to the ID-verification service to compare the printed name and student number with your registration. Captures and OCR text are not saved by this flow. A sensitive, signed verification receipt is held only in memory for up to 10 minutes and submitted immediately for registration. Cancelling, leaving, or backgrounding signup discards it.</Text>
          </> : <>
            <Text style={[s.paragraph, { color: body }]}>By using MonteAI and MonteSkolar, you agree to the following terms and conditions:</Text>
            <Text style={[s.paragraph, { color: body }]}>You must be a currently enrolled student of Colegio de Montalban. By accepting, you confirm that you are currently studying at the college.</Text>
            <Text style={[s.paragraph, { color: body }]}>You are solely responsible for your interactions and the messages you send to MonteAI.</Text>
            <Text style={[s.paragraph, { color: body }]}>Do not send illegal, harmful, threatening, abusive, harassing, defamatory, vulgar, obscene, hateful, racially or ethnically objectionable, or otherwise objectionable messages to MonteAI.</Text>
            <Text style={[s.paragraph, { color: body }]}>Do not impersonate any other person or entity on MonteAI.</Text>
            <Text style={[s.paragraph, { color: body }]}>We reserve the right to terminate access to MonteAI and report users who violate community guidelines to the guidance office.</Text>
          </>}
        </ScrollView>
        <View style={s.footer}>
          <Pressable accessibilityRole="button" onPress={() => setNotice(null)} style={s.dismiss}><Text style={{ color: body }}>Not now</Text></Pressable>
          <PrimaryButton label="I have read and agree" disabled={disabled} onPress={() => {
            if (notice === 'privacy') onPrivacyChange(true);
            if (notice === 'terms') onTermsChange(true);
            setNotice(null);
          }} />
        </View>
      </SafeAreaView>
    </Modal>
  </View>;
}

const s = StyleSheet.create({
  group: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md },
  check: { padding: Spacing.xs },
  flex: { flex: 1 },
  link: { fontSize: FontSize.md, fontWeight: '600', textDecorationLine: 'underline' },
  small: { fontSize: FontSize.sm, marginTop: Spacing.xs },
  modal: { flex: 1, padding: Spacing.lg },
  title: { fontSize: FontSize.xl, fontWeight: '600', paddingVertical: Spacing.md },
  notice: { gap: Spacing.md, paddingBottom: Spacing.lg },
  paragraph: { fontSize: FontSize.md, lineHeight: 23 },
  footer: { gap: Spacing.sm, paddingTop: Spacing.md },
  dismiss: { padding: Spacing.sm, alignItems: 'center' },
});
