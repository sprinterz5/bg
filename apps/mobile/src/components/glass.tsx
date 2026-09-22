import { BlurView } from 'expo-blur';
import type { ReactNode, RefObject } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  children: ReactNode;
  blurTarget?: RefObject<View | null>;
  style?: StyleProp<ViewStyle>;
  radius?: number;
};

export function Glass({ children, blurTarget, style, radius = 13 }: Props) {
  return (
    <View style={[styles.shell, { borderRadius: radius }, style]}>
      <BlurView
        intensity={20}
        tint="light"
        blurTarget={blurTarget}
        blurMethod="dimezisBlurViewSdk31Plus"
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, styles.tint]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  tint: { backgroundColor: 'rgba(255,255,255,0.8)' },
});
