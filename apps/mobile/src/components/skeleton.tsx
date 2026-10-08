import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

// Loading placeholders (not in the design): grey blocks shaped like the content, pulsing softly. Blocks that mount
// together pulse together. Sizes follow the real components (profile.tsx, connections-screen.tsx).
const FILL = '#EEF1F3';

export function Skeleton({ width, height, radius = 4, style }: { width?: number | `${number}%`; height: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const o = useSharedValue(1);
  useEffect(() => {
    o.set(withRepeat(withTiming(0.45, { duration: 800, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [o]);
  const pulse = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View collapsable={false} style={[{ width, height, borderRadius: radius, backgroundColor: FILL }, style, pulse]} />;
}

/** ProfileSummary: avatar 90 at x 11, name and three stat columns at x 131 / 206 / 296. */
export function ProfileSummarySkeleton() {
  return (
    <View style={styles.top}>
      <Skeleton width={90} height={90} radius={45} />
      <View style={styles.right}>
        <Skeleton width={120} height={15} style={styles.mt2} />
        <View style={styles.stats}>
          {[75, 90, 0].map((w, i) => (
            <View key={i} style={w ? { width: w } : null}>
              <Skeleton width={26} height={14} />
              <Skeleton width={54} height={11} style={styles.mt4} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/** Two buttons in ProfileButtons. */
export function ProfileButtonsSkeleton({ height = 28 }: { height?: number }) {
  return (
    <>
      <Skeleton height={height} radius={7} style={styles.flex} />
      <Skeleton height={height} radius={7} style={styles.flex} />
    </>
  );
}

/** ProfilePostRow: thumbnail 142x89, title lines and the meta line next to it. */
export function ProfilePostRowSkeleton() {
  return (
    <View style={styles.post}>
      <Skeleton width={142} height={89} radius={12} />
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
      {button ? <Skeleton width={105} height={29} radius={7} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mt2: { marginTop: 2 },
  mt4: { marginTop: 4 },
  mt6: { marginTop: 6 },
  mt12: { marginTop: 12 },
  top: { flexDirection: 'row', paddingLeft: 11, marginTop: 12 },
  right: { marginLeft: 30, paddingTop: 3 },
  stats: { flexDirection: 'row', marginTop: 16 },
  post: { flexDirection: 'row', paddingLeft: 11, paddingRight: 16.2, marginBottom: 17 },
  postText: { flex: 1, marginLeft: 17, paddingRight: 10 },
  row: { height: 72, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, gap: 13 },
  names: { flex: 1 },
});
