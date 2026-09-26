import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Unused: the press-shrink animation was removed; kept so call sites stay unchanged. */
  scaleTo?: number;
  haptic?: boolean;
};

/** Plain pressable with optional haptics (no scale animation on press). */
export function PressableScale({ children, haptic = false, onPress, scaleTo: _scaleTo, ...rest }: Props) {
  return (
    <Pressable
      {...rest}
      onPress={(e) => {
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}>
      {children}
    </Pressable>
  );
}
