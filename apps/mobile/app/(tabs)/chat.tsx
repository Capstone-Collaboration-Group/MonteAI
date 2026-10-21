import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '@/components/ui/ScaledText';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useDrawerChats } from '@/hooks/useDrawerChats';
import { AppHeader } from '@/components/ui/AppHeader';
import { DrawerProvider } from '@/components/ui/DrawerProvider';
import { TabScreenTransition } from '@/components/ui/TabScreenTransition';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { chatService } from '@/lib/chatService';
import { useAuthSession } from '@/contexts/AuthSessionContext';
import type { ChatSessionResponseDto, ChatSourceDto } from '@monteai/types';

interface Message {
  id: string;
  role: 'ai' | 'user';
  text: string;
  status?: string;
  sources?: ChatSourceDto[] | null;
}

/** Hard cap on user input length (enforced on the TextInput and defensively in handleSend). */
const MAX_INPUT_LENGTH = 150;

const WELCOME_MSG: Message = {
  id: 'welcome',
  role: 'ai',
  text: 'Hello! I\'m MonteAI, your research assistant. How can I help you today?',
};

function toMessage(role: string, text: string, id: string, sources?: ChatSourceDto[] | null): Message {
  return { id, role: role === 'user' ? 'user' : 'ai', text, sources };
}

// Chat sources persisted while Pinecone metadata was read through
// MetadataValue.ToString() carry JSON-quoted ids ("c09a…"). Strip any
// surrounding quotes so old messages still deep-link to a valid route
// (mirrors cleanThesisId in packages/ui ChatView).
function cleanThesisId(id: string): string {
  return id.replace(/^"+|"+$/g, '');
}

export default function ChatScreen() {
  const { session: authSession } = useAuthSession();
  const userId = authSession?.uid ?? null;
  const router = useRouter();

  // Drawer requests arrive as an `open` route param (see SidebarDrawer):
  //   "s:<sessionId>:<timestamp>" — open that session
  //   "n:<timestamp>"             — start a fresh chat
  // The timestamp keeps every tap unique so each one is processed once.
  const { open } = useLocalSearchParams<{ open?: string }>();

  const [session, setSession] = useState<ChatSessionResponseDto | null>(null);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MSG]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionMenuVisible, setSessionMenuVisible] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');
  const [sessionActionBusy, setSessionActionBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const { recentChats, loading: chatsLoading, refresh } = useDrawerChats();

  const background = useThemeColor({}, 'background');
  const heading = useThemeColor({}, 'onSurface');
  const body = useThemeColor({}, 'onSurfaceVariant');
  const surface = useThemeColor({}, 'surfaceContainerLow');
  const primary = useThemeColor({}, 'primary');
  const onPrimary = useThemeColor({}, 'onPrimary');
  const outline = useThemeColor({}, 'outlineVariant');
  const insets = useSafeAreaInsets();

  const startNewChat = useCallback(() => {
    setSession(null);
    setMessages([WELCOME_MSG]);
    setSessionMenuVisible(false);
  }, []);

  const toggleSessionPinned = async () => {
    if (!session || sessionActionBusy) return;
    setSessionMenuVisible(false);
    setSessionActionBusy(true);
    try {
      const pinned = !session.pinned;
      const updated = await chatService.setSessionPinned(session.id, pinned);
      if (!updated) throw new Error('Could not update the pinned chat.');
      setSession({ ...session, pinned });
      await refresh(true);
    } catch (error) {
      Alert.alert(
        'Could not update chat',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setSessionActionBusy(false);
    }
  };

  const saveSessionTitle = async () => {
    if (!session || sessionActionBusy) return;
    const title = renameTitle.trim();
    if (!title) {
      Alert.alert('Chat name required', 'Enter a name for this conversation.');
      return;
    }

    setSessionActionBusy(true);
    try {
      const updated = await chatService.updateChatSession(session.id, { title });
      if (!updated) throw new Error('Could not rename this chat.');
      setSession({ ...session, title });
      setRenameVisible(false);
      await refresh(true);
    } catch (error) {
      Alert.alert(
        'Could not rename chat',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setSessionActionBusy(false);
    }
  };

  const deleteSession = async () => {
    if (!session || sessionActionBusy) return;

    setSessionActionBusy(true);
    try {
      await chatService.deleteSession(session.id);
      setSession(null);
      setMessages([WELCOME_MSG]);
      await refresh(true);
    } catch (error) {
      Alert.alert(
        'Could not delete chat',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setSessionActionBusy(false);
    }
  };

  const confirmDeleteSession = () => {
    if (!session) return;
    setSessionMenuVisible(false);
    Alert.alert(
      'Delete chat?',
      `This permanently deletes "${session.title}" and its messages. This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void deleteSession() },
      ]
    );
  };

  const handleSelectSession = useCallback(
    async (id: string) => {
      if (session?.id === id || loadingHistory) return;

      setLoadingHistory(true);
      try {
        const s = await chatService.getSession(id);
        if (!s) return;

        setSession(s);
        // Messages arrive latest-first; reverse so the conversation reads
        // chronologically and the latest message is scrolled into view.
        setMessages(
          s.messages
            .map((m) => toMessage(m.role, m.content, m.id, m.sources))
            .reverse()
        );
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, role: 'ai', text: 'Could not load this conversation. Please try again.' },
        ]);
      } finally {
        setLoadingHistory(false);
      }
    },
    [session, loadingHistory]
  );

  // Handle drawer requests (recent chat tapped / new chat) from any tab.
  const handledOpen = useRef<string | null>(null);
  useEffect(() => {
    if (!open || handledOpen.current === open) return;
    handledOpen.current = open;
    const [kind, id] = open.split(':');
    if (kind === 's' && id) {
      void handleSelectSession(id);
    } else if (kind === 'n') {
      startNewChat();
    }
  }, [open, handleSelectSession, startNewChat]);

  async function handleSend() {
    const text = input.trim().slice(0, MAX_INPUT_LENGTH);
    if (!text || sending || loadingHistory) return;

    if (!userId) {
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: 'ai', text: 'Please sign in to start chatting.' },
      ]);
      return;
    }

    setSending(true);
    setInput('');
    // Optimistic user bubble + a streaming AI draft that fills in as
    // status/delta/source SSE events arrive.
    const draftId = `a-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', text },
      { id: draftId, role: 'ai', text: '', status: 'Thinking…' },
    ]);

    try {
      let activeSession = session;

      if (!activeSession) {
        activeSession = await chatService.createSession({
          userId,
          title: text.slice(0, 100),
        });
        setSession(activeSession);
      }

      const patchDraft = (patch: Partial<Message> | ((m: Message) => Partial<Message>)) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== draftId) return m;
            const p = typeof patch === 'function' ? patch(m) : patch;
            return { ...m, ...p };
          })
        );
      };

      const res = await chatService.sendMessageStream(
        activeSession.id,
        { role: 'user', content: text },
        {
          onStatus: (message) => patchDraft({ status: message }),
          onSources: (sources) => patchDraft({ sources }),
          onDelta: (fragment) => patchDraft((m) => ({ text: m.text + fragment })),
        }
      );
      // Swap the draft for the persisted assistant message (final content,
      // sources, real id) so it matches what history reload will show.
      setMessages((prev) =>
        prev.map((m) => (m.id === draftId ? toMessage(res.role, res.content, res.id, res.sources) : m))
      );
      // Once the response is back, silently refresh the session list so a
      // newly created chat is pushed to the top of the history in real time.
      refresh(true);
    } catch (err) {
      // Prefer the server-provided friendly message (rate limit, breaker…).
      const text =
        err instanceof Error && err.message
          ? err.message
          : 'Sorry, something went wrong. Please try again.';
      setMessages((prev) =>
        prev.map((m) => (m.id === draftId ? { id: `err-${Date.now()}`, role: 'ai', text } : m))
      );
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

    return (
    <TabScreenTransition>
    <DrawerProvider recentChats={recentChats} recentLoading={chatsLoading}>
      {(openDrawer) => (
        <KeyboardAvoidingView
          style={[s.root, { backgroundColor: background }]}
          behavior="padding"
          keyboardVerticalOffset={0}>
          <SafeAreaView style={{ flex: 0 }} edges={['top']}>
            <AppHeader
              title="MonteAI"
              leftIcon="menu"
              onLeftPress={openDrawer}
              rightIcons={
                session
                  ? [{ icon: 'more-vert', onPress: () => setSessionMenuVisible(true) }]
                  : []
              }
            />
          </SafeAreaView>

          <Modal
            visible={sessionMenuVisible && !!session}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={() => setSessionMenuVisible(false)}>
            <View style={s.menuOverlay}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => setSessionMenuVisible(false)}
                accessibilityLabel="Close chat actions"
              />
              <View
                style={[
                  s.sessionMenu,
                  { backgroundColor: surface, borderColor: outline, top: insets.top + 58 },
                ]}>
                <Pressable
                  style={s.sessionMenuItem}
                  onPress={() => void toggleSessionPinned()}
                  disabled={sessionActionBusy}
                  accessibilityRole="button">
                  <MaterialIcons name="push-pin" size={20} color={primary} />
                  <Text style={[s.sessionMenuText, { color: heading }]}>
                    {session?.pinned ? 'Unpin chat' : 'Pin chat'}
                  </Text>
                </Pressable>
                <Pressable
                  style={s.sessionMenuItem}
                  onPress={() => {
                    if (!session) return;
                    setSessionMenuVisible(false);
                    setRenameTitle(session.title);
                    setRenameVisible(true);
                  }}
                  disabled={sessionActionBusy}
                  accessibilityRole="button">
                  <MaterialIcons name="edit" size={20} color={body} />
                  <Text style={[s.sessionMenuText, { color: heading }]}>Rename</Text>
                </Pressable>
                <Pressable
                  style={s.sessionMenuItem}
                  onPress={confirmDeleteSession}
                  disabled={sessionActionBusy || sending}
                  accessibilityRole="button">
                  <MaterialIcons name="delete-outline" size={20} color="#c62828" />
                  <Text style={[s.sessionMenuText, { color: '#c62828' }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          </Modal>

          <Modal
            visible={renameVisible}
            transparent
            animationType="fade"
            onRequestClose={() => {
              if (!sessionActionBusy) setRenameVisible(false);
            }}>
            <View style={s.renameOverlay}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => {
                  if (!sessionActionBusy) setRenameVisible(false);
                }}
                accessibilityLabel="Close rename dialog"
              />
              <View style={[s.renameDialog, { backgroundColor: surface, borderColor: outline }]}>
                <Text style={[s.renameHeading, { color: heading }]}>Rename chat</Text>
                <Text style={[s.renameDescription, { color: body }]}>
                  Choose a name for this conversation.
                </Text>
                <TextInput
                  value={renameTitle}
                  onChangeText={setRenameTitle}
                  maxLength={100}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => void saveSessionTitle()}
                  placeholder="Chat name"
                  placeholderTextColor={body}
                  style={[s.renameInput, { color: heading, borderColor: outline }]}
                />
                <View style={s.renameActions}>
                  <Pressable
                    onPress={() => setRenameVisible(false)}
                    disabled={sessionActionBusy}
                    style={[s.renameButton, { borderColor: outline }]}>
                    <Text style={[s.renameButtonText, { color: body }]}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void saveSessionTitle()}
                    disabled={sessionActionBusy}
                    style={[s.renameButton, { backgroundColor: primary, borderColor: primary }]}>
                    {sessionActionBusy ? (
                      <ActivityIndicator size="small" color={onPrimary} />
                    ) : (
                      <Text style={[s.renameButtonText, { color: onPrimary }]}>Save</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>

          <ScrollView
            ref={scrollRef}
            style={s.scroll}
            contentContainerStyle={s.messages}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {messages.map((msg) => (
              <View key={msg.id} style={[s.bubbleRow, msg.role === 'user' && s.bubbleRowUser]}>
                <View
                  style={[
                    s.bubble,
                    msg.role === 'user'
                      ? [s.bubbleUser, { backgroundColor: primary }]
                      : [s.bubbleAi, { backgroundColor: surface, borderColor: outline }],
                  ]}>
                  {msg.status ? (
                    <View style={s.statusRow}>
                      <MaterialIcons name="auto-awesome" size={14} color={primary} />
                      <Text style={[s.status, { color: primary }]}>{msg.status}</Text>
                    </View>
                  ) : null}
                  <Text style={[s.bubbleText, { color: msg.role === 'user' ? onPrimary : heading }]}>
                    {msg.text}
                  </Text>
                  {msg.role === 'ai' && msg.sources && msg.sources.length > 0 ? (
                    <View style={[s.sources, { borderTopColor: outline }]}>
                      <Text style={[s.sourcesLabel, { color: body }]}>Sources</Text>
                      {msg.sources.map((source, index) => {
                        const label = source.title ?? 'Untitled thesis';
                        const thesisId = source.thesisId ? cleanThesisId(source.thesisId) : '';
                        const caption = `[Source ${index + 1}] ${label}${
                          source.publicationYear ? ` (${source.publicationYear})` : ''
                        }`;
                        return thesisId ? (
                          <Pressable
                            key={thesisId || String(index)}
                            accessibilityRole="link"
                            accessibilityLabel={`Open ${label} in the thesis viewer`}
                            onPress={() => router.push(`/thesis/${thesisId}` as Href)}
                            style={s.sourceRow}>
                            <MaterialIcons name="menu-book" size={14} color={primary} style={s.sourceIcon} />
                            <Text style={[s.sourceText, { color: primary }]} numberOfLines={2}>
                              {caption}
                            </Text>
                          </Pressable>
                        ) : (
                          <View key={String(index)} style={s.sourceRow}>
                            <MaterialIcons name="menu-book" size={14} color={body} style={s.sourceIcon} />
                            <Text style={[s.sourceText, { color: body }]} numberOfLines={2}>
                              {caption}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                  {msg.role === 'ai' && msg.status ? (
                    <View style={s.actions}>
                      <Pressable style={[s.actionBtn, { borderColor: outline }]}>
                        <Text style={[s.actionText, { color: heading }]}>Cite</Text>
                      </Pressable>
                      <Pressable style={[s.actionBtn, { borderColor: outline }]}>
                        <Text style={[s.actionText, { color: heading }]}>Expand</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
            {loadingHistory && (
              <View style={s.typingRow}>
                <ActivityIndicator size="small" color={primary} />
                <Text style={[s.typingText, { color: body }]}>Loading conversation...</Text>
              </View>
            )}
          </ScrollView>

          {/* Input bar (in normal flow, no longer absolute) */}
          <SafeAreaView edges={['bottom']}>
            <View style={s.inputWrap}>
              <View style={[s.inputBar, { backgroundColor: surface, borderColor: outline }]}>
                <Pressable
                  hitSlop={8}
                  onPress={startNewChat}
                  accessibilityRole="button"
                  accessibilityLabel="Start a new chat">
                  <MaterialIcons name="add-circle-outline" size={24} color={body} />
                </Pressable>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="Ask MonteAI about your research..."
                  placeholderTextColor="#9ca3af"
                  style={[s.input, { color: heading }]}
                  multiline
                  maxLength={MAX_INPUT_LENGTH}
                  editable={!sending}
                />
                <Pressable hitSlop={8}>
                  <MaterialIcons name="photo" size={22} color={body} />
                </Pressable>
                <Pressable
                  style={[s.sendBtn, { backgroundColor: primary }]}
                  hitSlop={8}
                  onPress={handleSend}
                  disabled={sending || !input.trim()}>
                  <MaterialIcons name="send" size={20} color={onPrimary} />
                </Pressable>
              </View>
              <Text style={[s.disclaimer, { color: body }]}>
                MonteAI may provide inaccurate info. Verify key citations from primary sources.
              </Text>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      )}
    </DrawerProvider>
    </TabScreenTransition>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1},
  messages: { padding: Spacing.xl, gap: Spacing.lg },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '85%', borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.sm },
  bubbleUser: { borderBottomRightRadius: Radius.sm },
  bubbleAi: { borderBottomLeftRadius: Radius.sm, borderWidth: StyleSheet.hairlineWidth },
  bubbleText: { fontSize: FontSize.md, lineHeight: 22 },
  sources: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.sm, gap: 6 },
  sourcesLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  sourceRow: { flexDirection: 'row', alignItems: 'flex-start' },
  sourceIcon: { marginTop: 1, marginRight: 6 },
  sourceText: { flex: 1, fontSize: FontSize.sm, lineHeight: 18 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  status: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  actionBtn: { borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  actionText: { fontSize: FontSize.sm, fontWeight: '500' },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  typingText: { fontSize: FontSize.sm },
  inputWrap: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  input: { flex: 1, fontSize: FontSize.md, maxHeight: 80 },
  sendBtn: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  disclaimer: { fontSize: 11, textAlign: 'center', marginTop: Spacing.xs, opacity: 0.6 },
  menuOverlay: { flex: 1, backgroundColor: 'transparent' },
  sessionMenu: {
    position: 'absolute',
    right: Spacing.md,
    width: 200,
    paddingVertical: Spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  sessionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  sessionMenuText: { fontSize: FontSize.sm, fontWeight: '500' },
  renameOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: Spacing.xl,
  },
  renameDialog: {
    width: '100%',
    maxWidth: 420,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
  },
  renameHeading: { fontSize: FontSize.lg, fontWeight: '700' },
  renameDescription: { fontSize: FontSize.sm, marginTop: Spacing.xs },
  renameInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
    marginTop: Spacing.lg,
  },
  renameActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.lg },
  renameButton: {
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  renameButtonText: { fontSize: FontSize.sm, fontWeight: '600' },
});
