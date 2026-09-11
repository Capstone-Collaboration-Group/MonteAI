import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { useLocalSearchParams } from 'expo-router';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useDrawerChats } from '@/hooks/useDrawerChats';
import { AppHeader } from '@/components/ui/AppHeader';
import { DrawerProvider } from '@/components/ui/DrawerProvider';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { chatService } from '@/lib/chatService';
import { useAuthSession } from '@/contexts/AuthSessionContext';
import type { ChatSessionResponseDto } from '@monteai/types';

interface Message {
  id: string;
  role: 'ai' | 'user';
  text: string;
  status?: string;
}

const WELCOME_MSG: Message = {
  id: 'welcome',
  role: 'ai',
  text: 'Hello! I\'m MonteAI, your research assistant. How can I help you today?',
};

function toMessage(role: string, text: string, id: string): Message {
  return { id, role: role === 'user' ? 'user' : 'ai', text };
}

export default function ChatScreen() {
  const { session: authSession } = useAuthSession();
  const userId = authSession?.uid ?? null;

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
  const scrollRef = useRef<ScrollView>(null);
  const { recentChats, loading: chatsLoading, refresh } = useDrawerChats();

  const background = useThemeColor({}, 'background');
  const heading = useThemeColor({}, 'onSurface');
  const body = useThemeColor({}, 'onSurfaceVariant');
  const surface = useThemeColor({}, 'surfaceContainerLow');
  const primary = useThemeColor({}, 'primary');
  const onPrimary = useThemeColor({}, 'onPrimary');
  const outline = useThemeColor({}, 'outlineVariant');

  const startNewChat = useCallback(() => {
    setSession(null);
    setMessages([WELCOME_MSG]);
  }, []);

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
        setMessages(s.messages.map((m) => toMessage(m.role, m.content, m.id)).reverse());
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
    const text = input.trim();
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
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text }]);

    try {
      let activeSession = session;

      if (!activeSession) {
        activeSession = await chatService.createSession({
          userId,
          title: text.slice(0, 100),
        });
        setSession(activeSession);
      }

      const res = await chatService.sendMessage(activeSession.id, { role: 'user', content: text });
      setMessages((prev) => [...prev, toMessage(res.role, res.content, res.id)]);
      // Once the response is back, silently refresh the session list so a
      // newly created chat is pushed to the top of the history in real time.
      refresh(true);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: 'ai', text: 'Sorry, something went wrong. Please try again.' },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  return (
    <DrawerProvider recentChats={recentChats} recentLoading={chatsLoading}>
      {(openDrawer) => (
    <View style={[s.root, { backgroundColor: background }]}>
      <SafeAreaView style={{ flex: 0 }} edges={['top']}>
        <AppHeader
          title="MonteAI"
          leftIcon="menu"
          onLeftPress={openDrawer}
          rightIcons={[{ icon: 'share' }, { icon: 'expand-more' }]}
        />
      </SafeAreaView>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={s.messages}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        {messages.map((msg) => (
          <View key={msg.id} style={[s.bubbleRow, msg.role === 'user' && s.bubbleRowUser]}>
            <View
              style={[
                s.bubble,
                msg.role === 'user' ? [s.bubbleUser, { backgroundColor: primary }] : [s.bubbleAi, { backgroundColor: surface, borderColor: outline }],
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
              {msg.role === 'ai' && msg.status ? (
                <View style={s.actions}>
                  <Pressable style={[s.actionBtn, { borderColor: outline }]}><Text style={[s.actionText, { color: heading }]}>Cite</Text></Pressable>
                  <Pressable style={[s.actionBtn, { borderColor: outline }]}><Text style={[s.actionText, { color: heading }]}>Expand</Text></Pressable>
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
        {sending && (
          <View style={s.typingRow}>
            <ActivityIndicator size="small" color={primary} />
            <Text style={[s.typingText, { color: body }]}>MonteAI is thinking...</Text>
          </View>
        )}
      </ScrollView>

      {/* Input bar */}
      <SafeAreaView edges={['bottom']} style={s.inputSafe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
                editable={!sending}
              />
              <Pressable hitSlop={8}><MaterialIcons name="photo" size={22} color={body} /></Pressable>
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
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
      )}
    </DrawerProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  messages: { padding: Spacing.xl, paddingBottom: 200, gap: Spacing.lg },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '85%', borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.sm },
  bubbleUser: { borderBottomRightRadius: Radius.sm },
  bubbleAi: { borderBottomLeftRadius: Radius.sm, borderWidth: StyleSheet.hairlineWidth },
  bubbleText: { fontSize: FontSize.md, lineHeight: 22 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  status: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  actionBtn: { borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  actionText: { fontSize: FontSize.sm, fontWeight: '500' },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  typingText: { fontSize: FontSize.sm },
  inputSafe: { position: 'absolute', bottom: 0, left: 0, right: 0 },
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
});
