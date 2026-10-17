import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

// Loading placeholders (not in the design): grey blocks shaped like the content, pulsing softly. Blocks that mount
// together pulse together. Sizes follow the real components (profile.tsx, connections-screen.tsx).
const FILL = '#EFEFEF';

export function Skeleton({ width, height, radius = 4, style }: { width?: number | `${number}%`; height: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const o = useSharedValue(1);
  useEffect(() => {
    o.set(withRepeat(withTiming(0.45, { duration: 800, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [o]);
  const pulse = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View collapsable={false} style={[{ width, height, borderRadius: radius, backgroundColor: FILL }, style, pulse]} />;
}

/** ProfileSummary: name, "@username" and three stat columns on the left, avatar 106 on the right. */
export function ProfileSummarySkeleton() {
  return (
    <View style={styles.top}>
      <View style={styles.flex}>
        <Skeleton width={150} height={24} style={styles.mt18} />
        <Skeleton width={90} height={13} style={styles.mt14} />
        <View style={styles.stats}>
          {[72.4, 84.6, 0].map((w, i) => (
            <View key={i} style={w ? { width: w } : null}>
              <Skeleton width={24} height={14} />
              <Skeleton width={54} height={11} style={styles.mt6} />
            </View>
          ))}
        </View>
      </View>
      <Skeleton width={106} height={106} radius={53} style={styles.avatar} />
    </View>
  );
}

/** Two buttons in ProfileButtons. */
export function ProfileButtonsSkeleton() {
  return (
    <>
      <Skeleton height={42} radius={20} style={styles.flex} />
      <Skeleton height={42} radius={20} style={styles.flex} />
    </>
  );
}

/** ProfilePostRow: thumbnail 143x90, title lines and the meta line next to it. */
export function ProfilePostRowSkeleton() {
  return (
    <View style={styles.post}>
      <Skeleton width={143} height={90} radius={12} />
      <View style={styles.postText}>
        <Skeleton width="92%" height={12} style={styles.mt2} />
        <Skeleton width="80%" height={12} style={styles.mt6} />
        <Skeleton width="55%" height={12} style={styles.mt6} />
        <Skeleton width={90} height={10} style={styles.mt12} />
      </View>
    </View>
  );
}

/** Connections row: avatar 53, username and subtitle, optional 105-wide button. */
export function ConnectionRowSkeleton({ button }: { button: boolean }) {
  return (
    <View style={styles.row}>
      <Skeleton width={53} height={53} radius={26.5} />
      <View style={styles.names}>
        <Skeleton width={110} height={13} />
        <Skeleton width={80} height={11} style={styles.mt6} />
      </View>
      {button ? <Skeleton width={105} height={28} radius={7} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mt2: { marginTop: 2 },
  mt4: { marginTop: 4 },
  mt6: { marginTop: 6 },
  mt12: { marginTop: 12 },
  mt14: { marginTop: 14 },
  mt18: { marginTop: 18 },
  top: { flexDirection: 'row', paddingLeft: 15, paddingRight: 17 },
  avatar: { marginTop: 14.5, marginLeft: 12 },
  stats: { flexDirection: 'row', marginTop: 19 },
  post: { flexDirection: 'row', paddingLeft: 14.5, marginBottom: 18 },
  postText: { width: 172, marginLeft: 20.1 },
  row: { height: 74, flexDirection: 'row', alignItems: 'center', paddingLeft: 11, paddingRight: 10, gap: 13 },
  names: { flex: 1 },
});
