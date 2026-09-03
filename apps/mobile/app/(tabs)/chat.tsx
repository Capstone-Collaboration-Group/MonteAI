import React, { useEffect, useRef, useState } from 'react';
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
import { useThemeColor } from '@/hooks/use-theme-color';
import { AppHeader } from '@/components/ui/AppHeader';
import { DrawerProvider } from '@/components/ui/DrawerProvider';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { chatService } from '@/lib/chatService';
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

export default function ChatScreen() {
  const [session, setSession] = useState<ChatSessionResponseDto | null>(null);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const background = useThemeColor({}, 'background');
  const heading = useThemeColor({}, 'onSurface');
  const body = useThemeColor({}, 'onSurfaceVariant');
  const surface = useThemeColor({}, 'surfaceContainerLow');
  const primary = useThemeColor({}, 'primary');
  const onPrimary = useThemeColor({}, 'onPrimary');
  const outline = useThemeColor({}, 'outlineVariant');

  // Create a session on mount
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await chatService.createSession({ userId: 'mobile-user', title: 'New Chat' });
        if (active) setSession(s);
      } catch {
        // session stays null — send will be disabled
      }
    })();
    return () => { active = false; };
  }, []);

  async function handleSend() {
    const text = input.trim();
    if (!text || !session || sending) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await chatService.sendMessage(session.id, { role: 'user', content: text });
      const aiMsg: Message = {
        id: res.id,
        role: 'ai',
        text: res.content,
      };
      setMessages((prev) => [...prev, aiMsg]);
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
    <DrawerProvider>
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
              <Pressable hitSlop={8}><MaterialIcons name="add-circle-outline" size={24} color={body} /></Pressable>
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
