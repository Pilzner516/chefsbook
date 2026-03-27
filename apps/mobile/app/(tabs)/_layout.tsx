import React from 'react';
import { Text } from 'react-native';
import { Tabs } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: colors.tabBar, borderTopColor: colors.borderDefault },
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        headerStyle: { backgroundColor: colors.bgScreen },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Recipes', tabBarIcon: () => <TabIcon emoji={'\uD83D\uDCD6'} /> }} />
      <Tabs.Screen name="scan" options={{ title: 'Scan', tabBarIcon: () => <TabIcon emoji={'\uD83D\uDCF7'} /> }} />
      <Tabs.Screen name="plan" options={{ title: 'Plan', tabBarIcon: () => <TabIcon emoji={'\uD83D\uDCC5'} /> }} />
      <Tabs.Screen name="shop" options={{ title: 'Shop', tabBarIcon: () => <TabIcon emoji={'\uD83D\uDED2'} /> }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover', tabBarIcon: () => <TabIcon emoji={'\uD83C\uDF0E'} /> }} />
    </Tabs>
  );
}
