import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { SidebarDrawer, type DrawerRecentChat } from './SidebarDrawer';

interface DrawerProviderProps {
  children: (openDrawer: () => void) => React.ReactNode;
  recentChats?: DrawerRecentChat[];
  recentLoading?: boolean;
}

export function DrawerProvider({
  children,
  recentChats,
  recentLoading,
}: DrawerProviderProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Reset drawer whenever this tab gains focus (e.g. switching tabs).
  useFocusEffect(
    useCallback(() => {
      setDrawerOpen(false);
    }, []),
  );

  return (
    <>
      {children(openDrawer)}
      <SidebarDrawer
        visible={drawerOpen}
        onClose={closeDrawer}
        recentChats={recentChats}
        recentLoading={recentLoading}
      />
    </>
  );
}
