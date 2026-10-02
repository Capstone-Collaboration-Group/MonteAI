// apps/mobile/components/thesis/SubmitThesisFlow.tsx
//
// "Submit Thesis" 3-step flow: Metadata → File Upload → Review, finalized
// with a Submit button. Mirrors the web modal
// (apps/web/src/components/ThesisSubmissionModal.tsx) with native inputs.

import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';

import { useThemeColor } from '@/hooks/use-theme-color';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { TextField } from '@/components/ui/TextField';
import { FormField } from '@/components/ui/FormField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { thesisService } from '@/lib/thesisService';
import { userService } from '@/lib/userService';
import type { UserProfileDto } from '@monteai/types';

const MAX_FILE_SIZE_MB = 25;
const STEP_LABELS = ['Metadata', 'File Upload', 'Review'];

interface PickedFile {
  uri: string;
  name: string;
  size: number | null;
}

interface SubmitThesisFlowProps {
  onExit?: () => void;
}

function formatFileSize(bytes: number | null): string {
  if (bytes == null) return 'PDF';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getSubmitErrorMessage(err: unknown): string {
  const response = (err as { response?: { status?: number; data?: unknown } })
    ?.response;
  if (response?.status === 403) return 'You are not allowed to perform this action.';
  const data = response?.data;
  if (typeof data === 'string' && data.trim()) return data;
  if (data && typeof data === 'object' && 'Message' in data) {
    const message = (data as { Message?: unknown }).Message;
    if (typeof message === 'string' && message) return message;
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Something went wrong while submitting. Please try again.';
}

function StepProgress({ step }: { step: number }) {
  const primary = useThemeColor({}, 'primary');
  const body = useThemeColor({}, 'onSurfaceVariant');
  return (
    <View style={s.stepsRow}>
      {STEP_LABELS.map((label, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <React.Fragment key={label}>
            {i > 0 && (
              <View
                style={[s.stepLine, { backgroundColor: done ? primary : '#d1d5db' }]}
              />
            )}
            <View style={s.stepItem}>
              <View
                style={[
                  s.stepBadge,
                  (active || done) && { backgroundColor: primary },
                ]}>
                {done ? (
                  <MaterialIcons name="check" size={13} color="#fff" />
                ) : (
                  <Text style={[s.stepNum, { color: active ? '#fff' : body }]}>
                    {n}
                  </Text>
                )}
              </View>
              <Text
                numberOfLines={1}
                style={[
                  s.stepLabel,
                  { color: active ? primary : body },
                  active && s.stepLabelActive,
                ]}>
                {label}
              </Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

function ReadOnlyRow({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading?: boolean;
}) {
  const surface = useThemeColor({}, 'surfaceContainerLow');
  const heading = useThemeColor({}, 'onSurface');
  const body = useThemeColor({}, 'onSurfaceVariant');
  return (
    <View style={s.field}>
      <Text style={[s.roLabel, { color: body }]}>{label}</Text>
      <View style={[s.roBox, { backgroundColor: surface }]}>
        <Text style={[s.roValue, { color: heading }]}>
          {loading ? 'Loading…' : value || '—'}
        </Text>
      </View>
    </View>
  );
}

function ReviewRow({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  const heading = useThemeColor({}, 'onSurface');
  const body = useThemeColor({}, 'onSurfaceVariant');
  return (
    <View style={s.reviewRow}>
      <Text style={[s.reviewLabel, { color: body }]}>{label}</Text>
      <Text
        style={[
          s.reviewValue,
          { color: heading },
          multiline && s.reviewValueMultiline,
        ]}>
        {value || '—'}
      </Text>
    </View>
  );
}

export function SubmitThesisFlow({ onExit }: SubmitThesisFlowProps) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [abstract, setAbstract] = useState('');
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const background = useThemeColor({}, 'background');
  const primary = useThemeColor({}, 'primary');
  const heading = useThemeColor({}, 'onSurface');
  const body = useThemeColor({}, 'onSurfaceVariant');
  const surface = useThemeColor({}, 'surface');
  const outline = useThemeColor({}, 'outlineVariant');
  const danger = useThemeColor({}, 'error');

  useEffect(() => {
    let active = true;
    userService
      .getMe()
      .then((p) => {
        if (active) setProfile(p);
      })
      .catch(() => {
        // keep null — validated when advancing past step 1
      })
      .finally(() => {
        if (active) setLoadingProfile(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const program =
    profile?.researchGroup?.members
      .map((m) => m.program)
      .filter(Boolean)
      .join(', ') ||
  profile?.program ||
  '';
  const institute = profile?.researchGroup?.institute || profile?.institute || '';
  const members =
    profile?.researchGroup?.members.map((m) => m.name).join(', ') ||
    (profile ? `${profile.firstName} ${profile.lastName}` : '');
  const blocked = !loadingProfile && profile !== null && profile.role !== 'Student';

  const goBack = useCallback(() => {
    if (step > 1) {
      setErrors({});
      setStep((p) => p - 1);
    } else {
      onExit?.();
    }
  }, [onExit, step]);

  const validateStep = (): boolean => {
    const next: Record<string, string> = {};
    if (step === 1) {
      if (!title.trim()) next.title = 'Thesis title is required.';
      if (!abstract.trim()) next.abstract = 'Abstract is required.';
      if (!profile) {
        next.group = 'Could not load your profile. Check your connection and try again.';
      } else if (!program || !institute) {
        next.group =
          'Program and institute are missing — make sure your research group is set up.';
      }
    } else if (step === 2) {
      if (!file) next.file = 'Select your thesis PDF file.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setErrors({});
    setStep((p) => p + 1);
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;

      const isPdf =
        (asset.mimeType ?? '').toLowerCase() === 'application/pdf' ||
        asset.name.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        setErrors({ file: 'Please upload a PDF file.' });
        return;
      }
      if (asset.size != null && asset.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setErrors({ file: `File must be under ${MAX_FILE_SIZE_MB} MB.` });
        return;
      }

      setFile({ uri: asset.uri, name: asset.name, size: asset.size ?? null });
      setErrors({});
    } catch {
      setErrors({ file: 'Could not open the file picker. Please try again.' });
    }
  };

  const handleSubmit = async () => {
    if (!profile || !file || submitting) return;
    setSubmitting(true);
    setErrors({});
    try {
      await thesisService.submitThesis(
        {
          title: title.trim(),
          abstract: abstract.trim(),
          filePath: '',
          uploadedById: profile.id,
        },
        // React Native picks files as { uri, name, type } parts, not web Files.
        file as unknown as File,
      );
      setSubmitted(true);
    } catch (err) {
      setErrors({ submit: getSubmitErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[s.root, { backgroundColor: background }]}>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={s.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* ── Top nav ── */}
          <View style={s.nav}>
            <Pressable
              onPress={goBack}
              accessibilityRole="button"
              accessibilityLabel={step > 1 ? 'Go back' : 'Back'}
              hitSlop={12}
              style={s.navBtn}>
              <MaterialIcons name="chevron-left" size={26} color={heading} />
            </Pressable>
            <View style={s.flex} />
            <Pressable
              onPress={onExit}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={12}
              style={s.navBtn}>
              <MaterialIcons name="close" size={22} color={heading} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {submitted ? (
              <View style={s.centerBlock}>
                <View style={[s.iconBadge, { backgroundColor: '#dcfce7' }]}>
                  <MaterialIcons name="check-circle" size={34} color="#15803d" />
                </View>
                <Text style={[s.centerTitle, { color: heading }]}>
                  Submission received
                </Text>
                <Text style={[s.centerBody, { color: body }]}>
                  Your thesis has been sent and is now pending review. You can track
                  its status from the Library.
                </Text>
                <View style={s.actions}>
                  <PrimaryButton label="Back to Home" onPress={() => onExit?.()} />
                </View>
              </View>
            ) : blocked ? (
              <View style={s.centerBlock}>
                <View style={[s.iconBadge, { backgroundColor: '#fee2e2' }]}>
                  <MaterialIcons name="block" size={34} color="#ba1a1a" />
                </View>
                <Text style={[s.centerTitle, { color: heading }]}>
                  Only students can submit a thesis
                </Text>
                <Text style={[s.centerBody, { color: body }]}>
                  Your account doesn&apos;t have permission to use this feature.
                </Text>
                <View style={s.actions}>
                  <PrimaryButton label="Go back" onPress={() => onExit?.()} />
                </View>
              </View>
            ) : (
              <>
                <Text style={[s.title, { color: heading }]}>Submit your thesis</Text>
                <Text style={[s.subtitle, { color: body }]}>
                  Complete the {STEP_LABELS.length} steps below to send your paper
                  for review.
                </Text>

                <StepProgress step={step} />
                <Text style={[s.stepOf, { color: body }]}>
                  Step {step} of {STEP_LABELS.length} — {STEP_LABELS[step - 1]}
                </Text>

                {/* ── Step 1: Metadata ── */}
                {step === 1 && (
                  <View style={s.stepBody}>
                    <Text style={[s.stepHeader, { color: heading }]}>
                      Thesis details
                    </Text>
                    <Text style={[s.stepHint, { color: body }]}>
                      Add the title and abstract of your study.
                    </Text>

                    <TextField
                      label="Thesis title"
                      icon="title"
                      value={title}
                      onChangeText={setTitle}
                      placeholder="e.g. Machine Learning for Crop Disease Detection"
                      autoCapitalize="words"
                      maxLength={255}
                      error={errors.title}
                      hint="Maximum 255 characters"
                    />

                    <FormField label="Abstract" icon="notes" error={errors.abstract}>
                      <TextInput
                        value={abstract}
                        onChangeText={setAbstract}
                        placeholder="Brief summary of your study…"
                        placeholderTextColor="#9ca3af"
                        multiline
                        textAlignVertical="top"
                        style={[
                          s.textarea,
                          {
                            backgroundColor: surface,
                            borderColor: errors.abstract ? '#ba1a1a' : outline,
                            color: heading,
                          },
                        ]}
                      />
                    </FormField>

                    <ReadOnlyRow label="Program" value={program} loading={loadingProfile} />
                    <ReadOnlyRow label="Institute" value={institute} loading={loadingProfile} />
                    <ReadOnlyRow label="Thesis members" value={members} loading={loadingProfile} />

                    {errors.group ? (
                      <Text style={[s.errorText, { color: danger }]}>{errors.group}</Text>
                    ) : null}
                  </View>
                )}

                {/* ── Step 2: File Upload ── */}
                {step === 2 && (
                  <View style={s.stepBody}>
                    <Text style={[s.stepHeader, { color: heading }]}>
                      Upload your thesis file
                    </Text>
                    <Text style={[s.stepHint, { color: body }]}>
                      Attach the PDF of your thesis. You can replace it before
                      submitting.
                    </Text>

                    {file ? (
                      <View>
                        <View
                          style={[
                            s.fileCard,
                            { borderColor: primary, backgroundColor: surface },
                          ]}>
                          <View style={[s.fileIcon, { backgroundColor: primary + '19' }]}>
                            <MaterialIcons
                              name="picture-as-pdf"
                              size={22}
                              color="#ba1a1a"
                            />
                          </View>
                          <View style={s.flex}>
                            <Text
                              style={[s.fileName, { color: heading }]}
                              numberOfLines={1}>
                              {file.name}
                            </Text>
                            <Text style={[s.fileMeta, { color: body }]}>
                              {formatFileSize(file.size)}
                            </Text>
                          </View>
                        </View>
                        <View style={s.fileActionsRow}>
                          <Pressable onPress={pickFile} hitSlop={8}>
                            <Text style={[s.linkBtn, { color: primary }]}>Replace</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              setFile(null);
                              setErrors({});
                            }}
                            hitSlop={8}>
                            <Text style={[s.linkBtn, { color: danger }]}>Remove</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <View
                        style={[
                          s.dropzone,
                          { borderColor: outline, backgroundColor: surface },
                        ]}>
                        <View style={[s.fileIcon, { backgroundColor: primary + '19' }]}>
                          <MaterialIcons name="upload-file" size={28} color={primary} />
                        </View>
                        <Text style={[s.dropTitle, { color: heading }]}>
                          Choose your thesis file
                        </Text>
                        <Text style={[s.dropHint, { color: body }]}>
                          PDF only · up to {MAX_FILE_SIZE_MB} MB
                        </Text>
                        <Pressable
                          onPress={pickFile}
                          style={({ pressed }) => [
                            s.pickBtn,
                            { borderColor: outline },
                            pressed && s.pressed,
                          ]}>
                          <MaterialIcons name="attach-file" size={18} color={primary} />
                          <Text style={[s.pickLabel, { color: primary }]}>
                            Browse files
                          </Text>
                        </Pressable>
                      </View>
                    )}

                    {errors.file ? (
                      <Text style={[s.errorText, { color: danger }]}>{errors.file}</Text>
                    ) : null}
                  </View>
                )}

                {/* ── Step 3: Review ── */}
                {step === 3 && (
                  <View style={s.stepBody}>
                    <Text style={[s.stepHeader, { color: heading }]}>
                      Review &amp; submit
                    </Text>
                    <Text style={[s.stepHint, { color: body }]}>
                      Review the details of your research group before final
                      submission.
                    </Text>

                    <View style={[s.reviewCard, { backgroundColor: surface, borderColor: outline }]}>
                      <ReviewRow label="Thesis Title" value={title.trim()} />
                      <ReviewRow label="Program" value={program} />
                      <ReviewRow label="Institute" value={institute} />
                      <ReviewRow label="Abstract" value={abstract.trim()} multiline />
                      <ReviewRow
                        label={`Thesis Members (${members.split(',').filter((m) => m.trim()).length})`}
                        value={members}
                        multiline
                      />

                      <Text style={[s.reviewLabel, { color: body }]}>Attached File</Text>
                      <View
                        style={[s.fileCard, { borderColor: primary, backgroundColor: background }]}>
                        <View style={[s.fileIcon, { backgroundColor: primary + '19' }]}>
                          <MaterialIcons name="picture-as-pdf" size={22} color="#ba1a1a" />
                        </View>
                        <View style={s.flex}>
                          <Text style={[s.fileName, { color: heading }]} numberOfLines={1}>
                            {file?.name ?? '—'}
                          </Text>
                          <Text style={[s.fileMeta, { color: body }]}>
                            {formatFileSize(file?.size ?? null)}
                          </Text>
                        </View>
                      </View>
                      <View style={s.fileActionsRow}>
                        <Pressable onPress={() => setStep(2)} hitSlop={8}>
                          <Text style={[s.linkBtn, { color: primary }]}>Replace</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            setFile(null);
                            setErrors({});
                            setStep(2);
                          }}
                          hitSlop={8}>
                          <Text style={[s.linkBtn, { color: danger }]}>Remove</Text>
                        </Pressable>
                      </View>
                    </View>

                    <View style={[s.warning, { backgroundColor: '#fef3c7', borderColor: '#fcd34d' }]}>
                      <MaterialIcons name="warning" size={16} color="#92400e" />
                      <View style={s.flex}>
                        <Text style={[s.warningTitle, { color: '#92400e' }]}>
                          Final review required
                        </Text>
                        <Text style={[s.warningBody, { color: '#92400e' }]}>
                          Please ensure all information above is accurate. Once
                          submitted, you will not be able to modify the group
                          composition without administrative approval.
                        </Text>
                      </View>
                    </View>

                    {errors.submit ? (
                      <Text style={[s.errorText, { color: danger }]}>{errors.submit}</Text>
                    ) : null}
                  </View>
                )}

                {/* ── Actions ── */}
                <View style={s.actions}>
                  <PrimaryButton
                    label={
                      step < STEP_LABELS.length
                        ? 'Next'
                        : submitting
                          ? 'Submitting…'
                          : 'Submit'
                    }
                    onPress={step < STEP_LABELS.length ? handleNext : handleSubmit}
                    disabled={loadingProfile || submitting}
                    loading={submitting}
                    accessibilityLabel={
                      step < STEP_LABELS.length ? 'Next' : 'Submit thesis'
                    }
                  />
                </View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  navBtn: { padding: Spacing.sm },
  content: { flexGrow: 1, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl },
  title: { fontSize: FontSize.xxl, fontWeight: '700', marginTop: Spacing.sm },
  subtitle: { fontSize: FontSize.sm, lineHeight: 20, marginTop: Spacing.xs },
  // Step progress
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexShrink: 1 },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d1d5db',
  },
  stepNum: { fontSize: 11, fontWeight: '700' },
  stepLabel: { fontSize: FontSize.xs, fontWeight: '500' },
  stepLabelActive: { fontWeight: '700' },
  stepLine: { height: 2, flex: 1, borderRadius: 1, marginHorizontal: Spacing.xs },
  stepOf: { fontSize: FontSize.xs, textAlign: 'center', marginTop: Spacing.sm },
  // Steps
  stepBody: { paddingTop: Spacing.lg, gap: Spacing.lg },
  stepHeader: { fontSize: FontSize.xl, fontWeight: '700' },
  stepHint: { fontSize: FontSize.sm, lineHeight: 20, marginTop: -Spacing.md },
  textarea: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    fontSize: FontSize.md,
    minHeight: 132,
  },
  field: { gap: Spacing.xs },
  roLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  roBox: {
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  roValue: { fontSize: FontSize.sm, lineHeight: 20 },
  // Upload
  dropzone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  dropTitle: { fontSize: FontSize.md, fontWeight: '600' },
  dropHint: { fontSize: FontSize.xs },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  pickLabel: { fontSize: FontSize.sm, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileName: { fontSize: FontSize.sm, fontWeight: '600' },
  fileMeta: { fontSize: FontSize.xs, marginTop: 2 },
  fileActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.xl,
    marginTop: Spacing.sm,
  },
  linkBtn: { fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase' },
  // Review
  reviewCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  reviewRow: { gap: Spacing.xxs },
  reviewLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reviewValue: { fontSize: FontSize.sm, fontWeight: '500', lineHeight: 20 },
  reviewValueMultiline: { fontWeight: '400' },
  warning: {
    flexDirection: 'row',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  warningTitle: { fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase' },
  warningBody: { fontSize: FontSize.xs, lineHeight: 18, marginTop: 2 },
  errorText: { fontSize: FontSize.sm, fontWeight: '500' },
  // Center blocks (success / blocked)
  centerBlock: {
    alignItems: 'center',
    paddingTop: Spacing.xxxl,
    gap: Spacing.md,
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerTitle: { fontSize: FontSize.xl, fontWeight: '700', textAlign: 'center' },
  centerBody: { fontSize: FontSize.sm, lineHeight: 20, textAlign: 'center' },
  // Actions
  actions: { marginTop: Spacing.xxl },
});
