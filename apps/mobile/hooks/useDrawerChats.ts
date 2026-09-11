import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { chatService } from '@/lib/chatService';
import { useAuthSession } from '@/contexts/AuthSessionContext';
import type { ChatSessionResponseDto } from '@monteai/types';

/**
 * Chat-session list shared by every tab's sidebar drawer.
 *
 * - Refetches whenever the tab gains focus, so histories stay fresh after
 *   chatting in another tab (tab screens stay mounted, so a mount-only
 *   fetch would go stale).
 * - Exposes `refresh(silent)` for real-time updates — e.g. the chat screen
 *   calls it after a response arrives so a newly created session is pushed
 *   to the top of the history immediately.
 */
export function useDrawerChats() {
  const { session: authSession } = useAuthSession();
  const userId = authSession?.uid ?? null;
  const [recentChats, setRecentChats] = useState<ChatSessionResponseDto[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(
    async (silent = false) => {
      if (!userId) return;
      if (!silent) setLoading(true);
      try {
        const list = await chatService.getSessions(userId);
        setRecentChats(list);
      } catch {
        // keep showing the previously loaded list
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [userId]
  );

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { recentChats, loading, refresh };
}
