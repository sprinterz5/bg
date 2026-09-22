import { forwardRef } from 'react';
import { StyleSheet, type TextInputProps } from 'react-native';

import { colors } from '@/theme';
import { TextInput } from '@/components/text';

export const BigInput = forwardRef<TextInput, TextInputProps>(function BigInput({ style, ...props }, ref) {
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors.disabled}
      selectionColor={colors.primary}
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
    fontWeight: '500',
    color: colors.text,
    paddingVertical: 4,
    minHeight: 40,
  },
});
