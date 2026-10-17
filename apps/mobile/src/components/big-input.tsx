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
    fontSize: 26,
    fontFamily: INTER_FAMILIES['400'],
    color: colors.text,
    paddingVertical: 4,
    minHeight: 40,
  },
});
