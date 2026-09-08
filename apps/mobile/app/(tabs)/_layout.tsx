import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { CustomTabBar } from '@/components/ui/CustomTabBar';
import { useAuthSession } from '@/contexts/AuthSessionContext';

const TAB_ITEMS = [
  { key: 'home', icon: 'home', label: 'Home' },
  { key: 'library', icon: 'menu-book', label: 'Library' },
  { key: 'chat', icon: 'add', label: 'Chat' },
  { key: 'announcements', icon: 'campaign', label: 'Announce' },
  { key: 'profile', icon: 'person', label: 'Profile' },
] as const;

export default function TabLayout() {
  // This part will also handle the check for the session. 
  // If there's no existing session, redirect back. Continue if there is.
  const { session, restoring } = useAuthSession();

  if (restoring) return null;
  if (!session) return <Redirect href="/auth-entry" />;

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar items={TAB_ITEMS} activeKey={props.state.routes[props.state.index].name} onPress={(key) => props.navigation.navigate(key)} />}>
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="library" options={{ title: 'Library' }} />
      <Tabs.Screen name="chat" options={{ title: 'Chat' }} />
      <Tabs.Screen name="announcements" options={{ title: 'Announcements' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      {/* Pushed-to route (Home quick actions / sidebar drawer) — deliberately
          not part of the visible 5-item tab bar. */}
      <Tabs.Screen name="schedules" options={{ title: 'Schedules' }} />
    </Tabs>
  );
}
