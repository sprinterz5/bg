import { forwardRef } from 'react';
import {
  Text as RNText,
  TextInput as RNTextInput,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';

/**
 * The layouts are set in Inter, on both platforms. A custom family can't pick a weight inside itself, so each
 * weight is its own family: fontWeight is translated to the matching Inter file. Styles with an explicit
 * fontFamily are untouched.
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

// iOS swaps the native view when an input becomes multiline and the new one keeps the system (blue) caret: the colour
// is only re-applied when the selectionColor prop changes. A one-step-off shade for multiline inputs makes it change
// together with `multiline`, so the caret keeps its colour.
function multilineShade(color: TextInputProps['selectionColor']) {
  if (color === '#000000') return '#010101';
  if (color === '#FFFFFF') return '#FEFEFE';
  return color;
}

// The typing line (caret) and selection are black everywhere unless a screen sets its own (e.g. white on stories).
export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput(
  { style, selectionColor = '#000000', cursorColor = '#000000', ...props },
  ref,
) {
  const selection = props.multiline ? multilineShade(selectionColor) : selectionColor;
  return <RNTextInput ref={ref} selectionColor={selection} cursorColor={cursorColor} {...props} style={interStyle(style)} />;
});
// Same name as the component, like React Native's own TextInput (value + type).
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type TextInput = RNTextInput;

export const AnimatedText = Animated.createAnimatedComponent(Text);
