import { forwardRef } from 'react';
import {
  Platform,
  Text as RNText,
  TextInput as RNTextInput,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';

/**
 * Figma uses SF Pro (iOS system font). Its license forbids shipping it on Android, so Android gets Inter,
 * the closest free match. Android can't pick a weight inside one custom family, so each weight is its own
 * family: fontWeight is translated to the matching Inter file. Styles with an explicit fontFamily are untouched.
 */
export const INTER_FAMILIES = {
  '400': 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  '800': 'Inter_800ExtraBold',
  '900': 'Inter_900Black',
} as const;

const WEIGHT_ALIASES: Record<string, keyof typeof INTER_FAMILIES> = { normal: '400', bold: '700' };

function interStyle(style: StyleProp<TextStyle>): StyleProp<TextStyle> {
  if (Platform.OS !== 'android') return style;
  let weight: string | undefined;
  let family: string | undefined;
  const walk = (s: unknown) => {
    if (!s) return;
    if (Array.isArray(s)) return s.forEach(walk);
    if (typeof s === 'object') {
      const o = s as TextStyle;
      if (o.fontWeight != null) weight = String(o.fontWeight);
      if (o.fontFamily != null) family = o.fontFamily;
    }
  };
  walk(style);
  if (family) return style;
  const key = WEIGHT_ALIASES[weight ?? '400'] ?? (weight as keyof typeof INTER_FAMILIES);
  const fontFamily = INTER_FAMILIES[key] ?? INTER_FAMILIES['400'];
  return [style, { fontFamily, fontWeight: 'normal' }];
}

export const Text = forwardRef<RNText, TextProps>(function Text({ style, ...props }, ref) {
  return <RNText ref={ref} {...props} style={interStyle(style)} />;
});

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput({ style, ...props }, ref) {
  return <RNTextInput ref={ref} {...props} style={interStyle(style)} />;
});
export type TextInput = RNTextInput;

export const AnimatedText = Animated.createAnimatedComponent(Text);
