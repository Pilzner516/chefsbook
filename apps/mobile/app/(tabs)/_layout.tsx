import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { useAuthStore } from '../../lib/zustand/authStore';
import { FloatingTabBar } from '../../components/FloatingTabBar';

export default function TabLayout() {
  const session = useAuthStore((s) => s.session);
  const isAnonymous = session?.user?.is_anonymous === true;

  if (!session || isAnonymous) {
    return <Redirect href="/" />;
  }

  return (
    <Tabs
      tabBar={() => <FloatingTabBar />}
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
