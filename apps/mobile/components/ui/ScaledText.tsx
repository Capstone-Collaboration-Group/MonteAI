import React, { forwardRef } from 'react';
import {
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  type StyleProp,
  type TextProps,
  type TextInputProps,
  type TextStyle,
} from 'react-native';

import { useFontSize } from '@/contexts/FontSizeContext';

/**
 * Multiplies a text style's `fontSize` (and its paired `lineHeight`, so
 * scaled text never overlaps) by the in-app font-scale factor.
 *
 * Styles without an explicit numeric `fontSize` are returned untouched:
 * RN nested `<Text>` inherits the parent's size, so injecting a size here
 * would break inline inheritance (e.g. a colored `<Text>` inside a title).
 */
export function scaleStyle(
  style: StyleProp<TextStyle>,
  scale: number,
): StyleProp<TextStyle> {
  if (scale === 1 || style === null || style === undefined) {
    return style;
  }

  const flat = StyleSheet.flatten(style);
  if (!flat || typeof flat.fontSize !== 'number') {
    return style;
  }

  const scaled: TextStyle = { ...flat, fontSize: flat.fontSize * scale };
  if (typeof flat.lineHeight === 'number') {
    scaled.lineHeight = flat.lineHeight * scale;
  }
  return scaled;
}

/**
 * Drop-in replacement for React Native's `Text` that applies the in-app
 * font-size preference (Settings → Appearance).
 *
 * It subscribes to `FontSizeContext` itself rather than relying on a
 * root-level re-render: the app runs with the React Compiler
 * (`experiments.reactCompiler`), which memoizes JSX, so a state change at
 * the root would bail out before reaching nested text. Context consumers
 * are always re-rendered by React regardless of memoized ancestors, and
 * the fresh scaled style identity forces the underlying native text to
 * re-apply. Styles are baked into module-level `StyleSheet.create` values,
 * so scaling can only happen at render time — here, at the leaf.
 */
export const Text = forwardRef(function Text(
  { style, ...rest }: TextProps,
  ref: React.Ref<React.ComponentRef<typeof RNText>>,
) {
  const { scale } = useFontSize();
  return <RNText ref={ref} style={scaleStyle(style, scale)} {...rest} />;
});

Text.displayName = 'Text';

/**
 * `TextInput` counterpart of `Text` — input text and placeholder honor the
 * same font-size preference (styles flow through the identical `scaleStyle`).
 */
export const TextInput = forwardRef(function TextInput(
  { style, ...rest }: TextInputProps,
  ref: React.Ref<React.ComponentRef<typeof RNTextInput>>,
) {
  const { scale } = useFontSize();
  return <RNTextInput ref={ref} style={scaleStyle(style, scale)} {...rest} />;
});

TextInput.displayName = 'TextInput';
