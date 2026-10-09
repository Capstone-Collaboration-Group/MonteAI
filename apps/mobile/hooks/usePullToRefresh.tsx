// apps/mobile/hooks/usePullToRefresh.tsx
//
// Wraps an async refetch with the pull-to-refresh state and a themed
// <RefreshControl> that can be dropped straight onto a ScrollView/FlatList:
//
//   const load = useCallback(async () => { ... }, []);
//   const { refreshControl } = usePullToRefresh(load);
//   <ScrollView refreshControl={refreshControl}>...</ScrollView>
//
// The refetch is expected to update screen state; errors are swallowed here so
// each screen keeps owning its own empty/error UI.

import React, { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

interface PullToRefreshOptions {
  /** Optional label shown next to the spinner on iOS. */
  title?: string;
}

export function usePullToRefresh(
  refetch: () => Promise<unknown> | unknown,
  options: PullToRefreshOptions = {},
) {
  const [refreshing, setRefreshing] = useState(false);
  const tintColor = useThemeColor({}, 'primary');
  const progressBackgroundColor = useThemeColor({}, 'surfaceContainerLow');
  const titleColor = useThemeColor({}, 'onSurfaceVariant');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch {
      // Swallowed — the screen's own state reflects any failure.
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={tintColor}
      colors={[tintColor]}
      progressBackgroundColor={progressBackgroundColor}
      title={options.title}
      titleColor={titleColor}
    />
  );

  return { refreshing, onRefresh, refreshControl };
}
