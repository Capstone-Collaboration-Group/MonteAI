/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#005d41';
const tintColorDark = '#7dd8b0';

export const Colors = {
  light: {
    text: '#1b1b1c',
    background: '#fcf9f8',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,

    // MonteScholar tokens
    primary: '#005d41',
    primaryContainer: '#0d7856',
    onPrimary: '#ffffff',
    onPrimaryContainer: '#a1fdd2',
    secondary: '#006e00',
    secondaryContainer: '#8bf875',
    onSecondary: '#ffffff',
    surface: '#fcf9f8',
    surfaceContainer: '#f0eded',
    surfaceContainerLow: '#f6f3f2',
    surfaceContainerHigh: '#eae7e7',
    onSurface: '#1b1b1c',
    onSurfaceVariant: '#3e4943',
    outline: '#6e7a73',
    outlineVariant: '#bec9c1',
    error: '#ba1a1a',
    onError: '#ffffff',
    errorContainer: '#ffdad6',
    statusApproved: '#0D7856',
    statusPending: '#FFFF00',
    statusCritical: '#FF0000',
    statusDefense: '#008000',
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,

    // MonteScholar tokens — dark variants
    primary: '#7dd8b0',
    primaryContainer: '#005139',
    onPrimary: '#002115',
    onPrimaryContainer: '#a1fdd2',
    secondary: '#72de5e',
    secondaryContainer: '#005300',
    onSecondary: '#002200',
    surface: '#151718',
    surfaceContainer: '#1f2122',
    surfaceContainerLow: '#1a1c1d',
    surfaceContainerHigh: '#26282a',
    onSurface: '#ECEDEE',
    onSurfaceVariant: '#bec9c1',
    outline: '#889089',
    outlineVariant: '#3e4943',
    error: '#ffb4ab',
    onError: '#690005',
    errorContainer: '#93000a',
    statusApproved: '#5CC29A',
    statusPending: '#FFFF66',
    statusCritical: '#FF6B6B',
    statusDefense: '#4CAF50',
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});