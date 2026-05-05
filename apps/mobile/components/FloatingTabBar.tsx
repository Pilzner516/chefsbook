import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, router } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface TabDef {
  name: string;
  route: string;
  labelKey: string;
  icon: IoniconsName;
  iconActive: IoniconsName;
}

const TABS: TabDef[] = [
  {
    name: 'index',
    route: '/(tabs)',
    labelKey: 'nav.recipes',
    icon: 'book-outline',
    iconActive: 'book',
  },
  {
    name: 'search',
    route: '/search',
    labelKey: 'nav.search',
    icon: 'search-outline',
    iconActive: 'search',
  },
  {
    name: 'scan',
    route: '/scan',
    labelKey: 'nav.scan',
    icon: 'camera-outline',
    iconActive: 'camera',
  },
  {
    name: 'plan',
    route: '/plan',
    labelKey: 'nav.plan',
    icon: 'calendar-outline',
    iconActive: 'calendar',
  },
  {
    name: 'menus',
    route: '/menus',
    labelKey: 'nav.menus',
    icon: 'restaurant-outline',
    iconActive: 'restaurant',
  },
  {
    name: 'shop',
    route: '/shop',
    labelKey: 'nav.cart',
    icon: 'cart-outline',
    iconActive: 'cart',
  },
];

function isActive(pathname: string, tab: TabDef): boolean {
  if (tab.name === 'index') {
    return pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/';
  }
  return pathname === `/(tabs)/${tab.name}` || pathname === `/${tab.name}`;
}

export function FloatingTabBar() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const pillBottom = insets.bottom + 16;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: pillBottom + 64,
      }}
    >
      <View
        style={{
          position: 'absolute',
          bottom: pillBottom,
          left: 16,
          right: 16,
          height: 64,
          backgroundColor: '#ffffff',
          borderRadius: 32,
          borderWidth: 1,
          borderColor: colors.borderDefault,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingHorizontal: 8,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOpacity: 0.12,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
            },
            android: {
              elevation: 12,
            },
          }),
        }}
      >
        {TABS.map((tab) => {
          const active = isActive(pathname, tab);

          return (
            <TouchableOpacity
              key={tab.name}
              onPress={() => router.navigate(tab.route as any)}
              activeOpacity={0.7}
              style={{
                flex: 1,
                height: 64,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? colors.accentSoft : 'transparent',
                  borderRadius: 20,
                  paddingVertical: 4,
                  paddingHorizontal: 10,
                  gap: 2,
                }}
              >
                <Ionicons
                  name={active ? tab.iconActive : tab.icon}
                  size={20}
                  color={active ? colors.accent : colors.textMuted}
                />
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  style={{
                    fontSize: 10,
                    fontWeight: active ? '600' : '400',
                    color: active ? colors.accent : colors.textMuted,
                  }}
                >
                  {t(tab.labelKey)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
