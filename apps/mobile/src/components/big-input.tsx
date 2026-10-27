import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, type TextInputProps, type TextInputInstance } from 'react-native';

import { colors } from '@/theme';
import { INTER_FAMILIES, TextInput } from '@/components/text';

// autoFocus waits for the screen's slide-in: the keyboard rising during the push made the step jerk in.
const FOCUS_DELAY = 380;

export const BigInput = forwardRef<TextInputInstance, TextInputProps>(function BigInput({ style, autoFocus, ...props }, ref) {
  const inner = useRef<TextInputInstance>(null);
  useImperativeHandle(ref, () => inner.current as TextInputInstance);
  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => inner.current?.focus(), FOCUS_DELAY);
    return () => clearTimeout(t);
  }, [autoFocus]);
  return (
    <TextInput
      ref={inner}
      placeholderTextColor={colors.disabled}
      cursorColor={colors.text}
      autoCorrect={false}
      spellCheck={false}
      {...props}
      style={[styles.input, style]}
    />
  );
});

const styles = StyleSheet.create({
  input: {
    flex: 1,
    fontSize: 25.6,
    fontFamily: INTER_FAMILIES['500'],
    color: colors.text,
    paddingVertical: 4,
    // the frames' typed text starts ~4.5 in from the screen gutter
    paddingLeft: 4.5,
    minHeight: 40,
  },
});
