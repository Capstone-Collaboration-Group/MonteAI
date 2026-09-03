import React from 'react';
import { Tabs } from 'expo-router';
import { CustomTabBar } from '@/components/ui/CustomTabBar';

const TAB_ITEMS = [
  { key: 'home', icon: 'home', label: 'Home' },
  { key: 'library', icon: 'menu-book', label: 'Library' },
  { key: 'chat', icon: 'add', label: 'Chat' },
  { key: 'announcements', icon: 'campaign', label: 'Announce' },
  { key: 'profile', icon: 'person', label: 'Profile' },
] as const;

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar items={TAB_ITEMS} activeKey={props.state.routes[props.state.index].name} onPress={(key) => props.navigation.navigate(key)} />}>
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="library" options={{ title: 'Library' }} />
      <Tabs.Screen name="chat" options={{ title: 'Chat' }} />
      <Tabs.Screen name="announcements" options={{ title: 'Announcements' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
