import { useColorScheme } from 'react-native';

import { Colors, type Palette } from '@/constants/theme';

export function useTheme(): Palette {
  const scheme = useColorScheme();
  return Colors[scheme === 'dark' ? 'dark' : 'light'];
}

export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}
