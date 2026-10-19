/**
 * Design tokens for MonteSkolar mobile.
 * Use these instead of raw numbers/strings in StyleSheet definitions.
 * Colors still come from `@monteai/types` → `Colors` (light + dark).
 */

import { Platform } from 'react-native';
import { Colors } from '@monteai/types';

export { Colors }; // single source of truth lives in packages/types

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const Radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 9999,
} as const;

export const FontSize = {
  xs: 13,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 28,
  display: 35,
} as const;

/**
 * In-app font scaling (Settings → Appearance → font size).
 *
 * `FontSize` values are baked into module-level `StyleSheet.create` objects
 * at import time, so they can only be scaled at render time. The app runs
 * with the React Compiler (`experiments.reactCompiler`), which memoizes
 * JSX — a root-level state change bails out before reaching nested text, so
 * re-rendering from the root is not enough to restyle the tree.
 *
 * The live preference therefore lives in `contexts/FontSizeContext.tsx`
 * (persisted under `FONT_SIZE_STORAGE_KEY`), and every text node renders
 * through `components/ui/ScaledText.tsx`, which consumes that context
 * itself and multiplies baked `fontSize`/`lineHeight` by the current scale
 * via `scaleStyle`. Context consumers always re-render regardless of
 * memoized ancestors, so the preference applies app-wide instantly.
 */
export type FontSizeChoice = 'Small' | 'Medium' | 'Large';

export const FONT_SIZE_STORAGE_KEY = 'monteai.settings.fontSize';

export const FONT_SIZE_SCALES: Record<FontSizeChoice, number> = {
  Small: 0.9,
  Medium: 1,
  Large: 1.2,
};