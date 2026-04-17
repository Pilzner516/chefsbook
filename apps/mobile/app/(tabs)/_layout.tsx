import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { useAuthStore } from '../../lib/zustand/authStore';

export default function TabLayout() {
  const session = useAuthStore((s) => s.session);
  const isAnonymous = session?.user?.is_anonymous === true;

  if (!session || isAnonymous) {
    return <Redirect href="/" />;
  }

  // FloatingTabBar is mounted at the root layout so it persists across detail
  // screens (recipe/[id], cookbook/[id], chef/[id], share/[token], recipe/new).
  // We render a null tabBar here to avoid a second instance inside the Tabs layout.
  return (
    <Tabs
      tabBar={() => null}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="scan" />
      <Tabs.Screen name="plan" />
      <Tabs.Screen name="shop" />
    </Tabs>
  );
}
