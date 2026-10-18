import { forwardRef } from 'react';
import { StyleSheet, type TextInputProps } from 'react-native';

import { colors } from '@/theme';
import { INTER_FAMILIES, TextInput } from '@/components/text';

export const BigInput = forwardRef<TextInput, TextInputProps>(function BigInput({ style, ...props }, ref) {
  return (
    <TextInput
      ref={ref}
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
