import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useTabBarHeight() {
  const insets = useSafeAreaInsets();
  return 64 + insets.bottom + 32;
}
