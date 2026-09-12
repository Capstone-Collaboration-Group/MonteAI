// apps/mobile/app/(tabs)/research-group.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useThemeColor } from '@/hooks/use-theme-color';
import { useDrawerChats } from '@/hooks/useDrawerChats';
import { useAuthSession } from '@/contexts/AuthSessionContext';
import { AppHeader } from '@/components/ui/AppHeader';
import { DrawerProvider } from '@/components/ui/DrawerProvider';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { studentService } from '@/lib/studentService';
import { researchGroupService } from '@/lib/researchGroupService';
import type {
  ResearchGroupMemberDto,
  ResearchGroupResponseDto,
  StudentResponseDto,
} from '@monteai/types';

const MAX_MEMBERS = 4;

/** Fade + slide entrance used to stagger the group card and member rows. */
function FadeIn({
  delay = 0,
  children,
  style,
}: {
  delay?: number;
  children: React.ReactNode;
  style?: object;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(14);

  useEffect(() => {
    const easing = Easing.out(Easing.cubic);
    opacity.value = withDelay(delay, withTiming(1, { duration: 320, easing }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 320, easing }));
  }, [delay, opacity, translateY]);

  const animated = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[animated, style]}>{children}</Animated.View>;
}

function initials(first?: string, last?: string): string {
  return `${(first ?? '')[0] ?? ''}${(last ?? '')[0] ?? ''}`.toUpperCase() || '??';
}

/**
 * Research Group screen — the student-facing view of their thesis team.
 * Students can create their one group (becoming its leader), rename it,
 * invite up to 3 classmates, and remove members. Reached from the
 * sidebar drawer.
 */
export default function ResearchGroupScreen() {
  const background = useThemeColor({}, 'background');
  const heading = useThemeColor({}, 'onSurface');
  const body = useThemeColor({}, 'onSurfaceVariant');
  const surface = useThemeColor({}, 'surfaceContainerLow');
  const outline = useThemeColor({}, 'outlineVariant');
  const primary = useThemeColor({}, 'primary');
  const onPrimary = useThemeColor({}, 'onPrimary');

  const { session } = useAuthSession();
  const { recentChats, loading: chatsLoading } = useDrawerChats();

  const [students, setStudents] = useState<StudentResponseDto[]>([]);
  const [groups, setGroups] = useState<ResearchGroupResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Create-group form
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupTitle, setNewGroupTitle] = useState('');

  // Rename-group form
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  // Invite-member section
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const [studentList, groupList] = await Promise.all([
          studentService.getStudents(),
          researchGroupService.getResearchGroups(),
        ]);
        if (!active) return;
        setStudents(Array.isArray(studentList) ? studentList : []);
        setGroups(Array.isArray(groupList) ? groupList : []);
      } catch {
        if (active) {
          setStudents([]);
          setGroups([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const currentStudent = useMemo(() => {
    if (students.length === 0) return null;
    return (
      students.find((s) => s.studentNumber === session?.studentNumber) ??
      students.find((s) => s.id === session?.uid) ??
      null
    );
  }, [students, session]);

  const myGroup = useMemo(() => {
    if (!currentStudent) return null;
    const fromMembership = groups.find((g) =>
      g.members.some((m) => m.id === currentStudent.id),
    );
    return fromMembership ?? currentStudent.researchGroup ?? null;
  }, [groups, currentStudent]);

  const isLeader = !!myGroup && !!currentStudent && myGroup.leaderId === currentStudent.id;
  const isFull = (myGroup?.members.length ?? 0) >= MAX_MEMBERS;

  const invitable = useMemo(() => {
    if (!myGroup) return [];
    const memberIds = new Set(myGroup.members.map((m) => m.id));
    const query = inviteQuery.trim().toLowerCase();
    const program = currentStudent?.program?.trim().toLowerCase();

    return students.filter((s) => {
      if (memberIds.has(s.id)) return false;
      // A student who already belongs to a group cannot be invited.
      if (s.researchGroup) return false;
      // Leaders may only invite classmates from their own program.
      if (program && s.program?.trim().toLowerCase() !== program) return false;
      if (!query) return true;
      const fullName = `${s.firstName} ${s.middleInitial ?? ''} ${s.lastName} ${s.suffix ?? ''}`
        .toLowerCase();
      return fullName.includes(query) || s.studentNumber.toLowerCase().includes(query);
    });
  }, [students, myGroup, currentStudent, inviteQuery]);

  const runAction = useCallback(
    async (action: () => Promise<unknown>, successMessage: string) => {
      setBusy(true);
      setFeedback(null);
      try {
        await action();
        setFeedback(successMessage);
        reload();
      } catch {
        setFeedback('Something went wrong. Please try again.');
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );

  const createGroup = () => {
    if (!newGroupName.trim() || !newGroupTitle.trim() || !currentStudent) return;
    void runAction(
      () =>
        researchGroupService.createResearchGroup({
          groupName: newGroupName.trim(),
          researchTitle: newGroupTitle.trim(),
          leaderId: currentStudent.id,
        }),
      'Research group created.',
    );
  };

  const renameGroup = () => {
    if (!myGroup || !renameValue.trim()) return;
    void runAction(
      () =>
        researchGroupService.updateResearchGroup(myGroup.id, {
          groupName: renameValue.trim(),
        }),
      'Group name updated.',
    );
    setRenaming(false);
  };

  const inviteMember = (student: StudentResponseDto) => {
    if (!myGroup) return;
    Alert.alert(
      'Invite student?',
      `Add ${student.firstName} ${student.lastName} (${student.studentNumber}) to ${myGroup.groupName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Invite',
          onPress: () =>
            void runAction(
              () => researchGroupService.addMember(myGroup.id, student.id),
              'Member invited to the group.',
            ),
        },
      ],
    );
  };

  const removeMember = (member: ResearchGroupMemberDto) => {
    if (!myGroup) return;
    Alert.alert(
      'Remove member?',
      `Remove ${member.name || member.studentNumber || member.id} from ${myGroup.groupName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Remove',
          style: 'destructive',
          onPress: () =>
            void runAction(
              () => researchGroupService.removeMember(myGroup.id, member.id),
              'Member removed from the group.',
            ),
        },
      ],
    );
  };

  return (
    <DrawerProvider recentChats={recentChats} recentLoading={chatsLoading}>
      {(openDrawer) => (
        <View style={[s.root, { backgroundColor: background }]}>
          <SafeAreaView style={{ flex: 0 }} edges={['top']}>
            <AppHeader
              title="Research Group"
              onLeftPress={openDrawer}
              rightIcons={[{ icon: 'refresh', onPress: reload }]}
            />
          </SafeAreaView>

          <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={s.loaderWrap}>
                <ActivityIndicator size="large" color={primary} />
              </View>
            ) : !myGroup ? (
              <FadeIn>
                <View style={[s.card, { backgroundColor: surface, borderColor: outline }]}>
                  <View style={s.cardHeader}>
                    <View style={[s.iconBadge, { backgroundColor: primary }]}>
                      <MaterialIcons name="group-add" size={22} color={onPrimary} />
                    </View>
                    <View style={s.cardHeaderText}>
                      <Text style={[s.cardTitle, { color: heading }]}>
                        Create your research group
                      </Text>
                      <Text style={[s.cardSubtitle, { color: body }]}>
                        You will lead a team of up to {MAX_MEMBERS} students working on one thesis.
                      </Text>
                    </View>
                  </View>

                  <Text style={[s.fieldLabel, { color: body }]}>GROUP NAME</Text>
                  <TextInput
                    style={[s.input, { borderColor: outline, color: heading }]}
                    placeholder="e.g. Group Alpha"
                    placeholderTextColor={body}
                    value={newGroupName}
                    onChangeText={setNewGroupName}
                    maxLength={100}
                  />
                  <Text style={[s.fieldLabel, { color: body }]}>RESEARCH TITLE</Text>
                  <TextInput
                    style={[s.input, { borderColor: outline, color: heading }]}
                    placeholder="e.g. AI-Driven Student Performance Prediction"
                    placeholderTextColor={body}
                    value={newGroupTitle}
                    onChangeText={setNewGroupTitle}
                    maxLength={255}
                  />

                  <Pressable
                    accessibilityRole="button"
                    disabled={busy || !newGroupName.trim() || !newGroupTitle.trim()}
                    style={({ pressed }) => [
                      s.primaryBtn,
                      { backgroundColor: primary },
                      pressed && { opacity: 0.85 },
                      (busy || !newGroupName.trim() || !newGroupTitle.trim()) && s.btnDisabled,
                    ]}
                    onPress={createGroup}>
                    {busy ? (
                      <ActivityIndicator size="small" color={onPrimary} />
                    ) : (
                      <Text style={[s.primaryBtnText, { color: onPrimary }]}>Create group</Text>
                    )}
                  </Pressable>
                </View>
              </FadeIn>
            ) : (
              <>
                <FadeIn>
                  <View style={[s.card, { backgroundColor: surface, borderColor: outline }]}>
                    <View style={s.cardHeader}>
                      <View style={[s.iconBadge, { backgroundColor: primary }]}>
                        <MaterialIcons name="group" size={22} color={onPrimary} />
                      </View>
                      <View style={s.cardHeaderText}>
                        {renaming ? (
                          <View style={s.renameRow}>
                            <TextInput
                              style={[s.renameInput, { borderColor: primary, color: heading }]}
                              value={renameValue}
                              onChangeText={setRenameValue}
                              maxLength={100}
                              autoFocus
                            />
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel="Save group name"
                              hitSlop={8}
                              onPress={renameGroup}
                              disabled={busy}>
                              <MaterialIcons name="check" size={20} color={primary} />
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel="Cancel renaming"
                              hitSlop={8}
                              onPress={() => setRenaming(false)}>
                              <MaterialIcons name="close" size={20} color={body} />
                            </Pressable>
                          </View>
                        ) : (
                          <View style={s.renameRow}>
                            <Text style={[s.cardTitle, { color: heading }]} numberOfLines={1}>
                              {myGroup.groupName}
                            </Text>
                            {isLeader && (
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Rename group"
                                hitSlop={8}
                                onPress={() => {
                                  setRenameValue(myGroup.groupName);
                                  setRenaming(true);
                                }}>
                                <MaterialIcons name="edit" size={18} color={body} />
                              </Pressable>
                            )}
                          </View>
                        )}
                        <Text style={[s.cardSubtitle, { color: body }]} numberOfLines={1}>
                          {myGroup.institute || 'Institute not specified'}
                        </Text>
                      </View>
                      <Text style={[s.memberCount, { color: primary }]}>
                        {myGroup.members.length}/{MAX_MEMBERS}
                      </Text>
                    </View>

                    <View style={[s.titleBox, { borderColor: outline }]}>
                      <Text style={[s.fieldLabel, { color: body }]}>RESEARCH TITLE</Text>
                      <Text style={[s.researchTitle, { color: heading }]}>
                        {myGroup.researchTitle}
                      </Text>
                    </View>
                  </View>
                </FadeIn>

                <FadeIn delay={90}>
                  <Text style={[s.sectionHeading, { color: heading }]}>Members</Text>
                  <View style={[s.memberList, { borderColor: outline, backgroundColor: surface }]}>
                    {myGroup.members.map((member, i) => (
                      <FadeIn key={member.id} delay={140 + i * 70}>
                        <View style={[s.memberRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: outline }]}>
                          <View style={[s.memberAvatar, { backgroundColor: primary }]}>
                            <Text style={s.memberAvatarText}>
                              {initials(member.name)}
                            </Text>
                          </View>
                          <View style={s.memberInfo}>
                            <Text style={[s.memberName, { color: heading }]} numberOfLines={1}>
                              {member.name || member.studentNumber || member.id}
                            </Text>
                            <Text style={[s.memberMeta, { color: body }]}>
                              {member.id === myGroup.leaderId ? 'Leader' : member.position}
                              {member.program ? ` — ${member.program}` : ''}
                            </Text>
                          </View>
                          {isLeader && member.id !== myGroup.leaderId && (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Remove ${member.name || member.id}`}
                              hitSlop={8}
                              disabled={busy}
                              onPress={() => removeMember(member)}>
                              <MaterialIcons name="person-remove" size={20} color="#ba1a1a" />
                            </Pressable>
                          )}
                        </View>
                      </FadeIn>
                    ))}
                  </View>
                </FadeIn>

                {isLeader && !isFull && (
                  <FadeIn delay={220}>
                    <Pressable
                      accessibilityRole="button"
                      style={[s.addMemberBtn, { borderColor: primary }]}
                      onPress={() => {
                        const next = !inviteOpen;
                        setInviteOpen(next);
                        if (next) setInviteQuery('');
                      }}>
                      <MaterialIcons
                        name={inviteOpen ? 'expand-less' : 'expand-more'}
                        size={22}
                        color={primary}
                      />
                      <Text style={[s.addMemberText, { color: primary }]}>
                        {inviteOpen ? 'Hide classmates' : 'Invite a classmate'}
                      </Text>
                    </Pressable>

                    {inviteOpen && (
                      <>
                        <Text style={[s.inviteHint, { color: body }]}>
                          {currentStudent?.program
                            ? `Search among ${currentStudent.program} classmates by name or student number.`
                            : 'Search by full name or student number.'}
                        </Text>
                        <View style={[s.searchBox, { borderColor: outline, backgroundColor: surface }]}>
                          <MaterialIcons name="search" size={20} color={body} />
                          <TextInput
                            style={[s.searchInput, { color: heading }]}
                            placeholder="Search name or student number..."
                            placeholderTextColor={body}
                            value={inviteQuery}
                            onChangeText={setInviteQuery}
                            autoCapitalize="none"
                          />
                          {inviteQuery.length > 0 && (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel="Clear search"
                              hitSlop={8}
                              onPress={() => setInviteQuery('')}>
                              <MaterialIcons name="close" size={18} color={body} />
                            </Pressable>
                          )}
                        </View>

                        <View style={[s.memberList, { borderColor: outline, backgroundColor: surface }]}>
                          {invitable.length === 0 ? (
                            <Text style={[s.emptyText, { color: body }]}>
                              {inviteQuery.trim()
                                ? 'No matching students found.'
                                : 'No other students are available to invite.'}
                            </Text>
                          ) : (
                            invitable.map((student, i) => (
                              <FadeIn key={student.id} delay={i * 50}>
                                <View style={[s.memberRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: outline }]}>
                                  <View style={[s.memberAvatar, { backgroundColor: primary }]}>
                                    <Text style={s.memberAvatarText}>
                                      {initials(student.firstName, student.lastName)}
                                    </Text>
                                  </View>
                                  <View style={s.memberInfo}>
                                    <Text style={[s.memberName, { color: heading }]} numberOfLines={1}>
                                      {student.firstName} {student.lastName}
                                    </Text>
                                    <Text style={[s.memberMeta, { color: body }]}>
                                      {student.studentNumber} — {student.program}
                                    </Text>
                                  </View>
                                  <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`Invite ${student.firstName} ${student.lastName}`}
                                    hitSlop={8}
                                    disabled={busy}
                                    onPress={() => inviteMember(student)}>
                                    <MaterialIcons name="person-add" size={22} color={primary} />
                                  </Pressable>
                                </View>
                              </FadeIn>
                            ))
                          )}
                        </View>
                      </>
                    )}
                  </FadeIn>
                )}

                {isFull && (
                  <FadeIn delay={220}>
                    <Text style={[s.fullNote, { color: body }]}>
                      Your group is full ({MAX_MEMBERS}/{MAX_MEMBERS} members).
                    </Text>
                  </FadeIn>
                )}
              </>
            )}

            {feedback && (
              <Text style={[s.feedback, { color: primary }]}>{feedback}</Text>
            )}
          </ScrollView>
        </View>
      )}
    </DrawerProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: Spacing.xl, paddingBottom: 100, gap: Spacing.md },
  loaderWrap: { paddingVertical: Spacing.xxxl, alignItems: 'center' },
  card: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: { flex: 1, gap: Spacing.xxs },
  cardTitle: { fontSize: FontSize.lg, fontWeight: '700' },
  cardSubtitle: { fontSize: FontSize.sm },
  memberCount: { fontSize: FontSize.lg, fontWeight: '700' },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: '600', letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: FontSize.md,
  },
  primaryBtn: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  primaryBtnText: { fontSize: FontSize.md, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
  renameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  renameInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  titleBox: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  researchTitle: { fontSize: FontSize.md, fontWeight: '600' },
  sectionHeading: { fontSize: FontSize.lg, fontWeight: '700', marginTop: Spacing.sm },
  memberList: { borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden' },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  memberAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '700' },
  memberInfo: { flex: 1, gap: 2 },
  memberName: { fontSize: FontSize.md, fontWeight: '600' },
  memberMeta: { fontSize: FontSize.xs },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
  },
  addMemberText: { fontSize: FontSize.md, fontWeight: '600' },
  inviteHint: { fontSize: FontSize.xs, paddingHorizontal: Spacing.xs },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  searchInput: { flex: 1, fontSize: FontSize.sm, paddingVertical: Spacing.sm },
  emptyText: { padding: Spacing.lg, fontSize: FontSize.sm, textAlign: 'center' },
  fullNote: { fontSize: FontSize.sm, textAlign: 'center', paddingVertical: Spacing.sm },
  feedback: { fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.sm },
});
