import { Image } from 'expo-image';
import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Animated, { Easing, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { INTER_FAMILIES, Text } from '@/components/text';
import type { ProfilePost } from '@/mock/data';
import { colors, motion } from '@/theme';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { RollingLabel } from './rolling-label';
import { openArticle } from '@/lib/article-origin';
import { push } from '@/lib/nav';
import { usePathname, type Href } from 'expo-router';

// Profile frames from the AutoLayouts export (other user / own): Inter throughout, name 26 bold on the left, avatar
// 106 on the right, "@username", three stat columns, two 42px buttons, bio, list / liked tabs, article rows.
// The header row (back or "+" · gear) is 36 tall (design y 47–83); everything below is laid out from y 83.
export const PROFILE_HEADER_H = 36;
const GRAY = '#EFF3F4';
const SUBTLE = '#999999';
const EASE = { duration: motion.base, easing: Easing.out(Easing.cubic) };

type SummaryProps = {
  username: string;
  name: string;
  avatar: ImageSourcePropType | null;
  articles: number;
  followers: string;
  following: number;
  bio: string[];
};

/** Name, "@username" and the stats on the left (x 13–15), avatar 106 at the right edge (17 in). Bio sits under the buttons. */
export function ProfileSummary({ username, name, avatar, articles, followers, following }: Omit<SummaryProps, 'bio'> & { bio?: string[] }) {
  // Stay on the same stack: the tab's own (/user/...) or the root one (/u/...).
  const root = usePathname().startsWith('/u/');
  const openList = (kind: 'followers' | 'following') => push(`/${root ? 'u' : 'user'}/${encodeURIComponent(username)}/${kind}` as Href);

  return (
    <View style={styles.top}>
      <View style={styles.left}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.username} numberOfLines={1}>
          @{username}
        </Text>
        <View style={styles.stats}>
          <Stat value={String(articles)} label="Articles" width={72.4} />
          <Stat value={followers} label="Followers" width={84.6} onPress={() => openList('followers')} />
          <Stat value={String(following)} label="Following" onPress={() => openList('following')} />
        </View>
      </View>
      {avatar ? (
        <Image source={avatar} style={styles.avatar} transition={150} />
      ) : (
        <Icon name="avatarPlaceholder" width={106} style={styles.avatar} />
      )}
    </View>
  );
}

/** Bio lines under the buttons: Inter 12.5 / 17.5, 15 from the left. */
export function ProfileBio({ bio }: { bio: string[] }) {
  if (!bio.length) return null;
  return (
    <View style={styles.bio}>
      {bio.map((line) => (
        <Text key={line} style={styles.bioText}>
          {line}
        </Text>
      ))}
    </View>
  );
}

function Stat({ value, label, width, onPress }: { value: string; label: string; width?: number; onPress?: () => void }) {
  return (
    <PressableScale disabled={!onPress} onPress={onPress} scaleTo={0.94} hitSlop={6} style={width ? { width } : undefined} accessibilityRole={onPress ? 'button' : undefined}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </PressableScale>
  );
}

/** Two equal 42px buttons 16 apart, 13 from the left and 17 from the right edge (like the avatar), at design y 228. */
export function ProfileButtons({ children }: { children: ReactNode }) {
  return <View style={styles.buttons}>{children}</View>;
}

export function ProfileButton({
  label,
  onPress,
  primary,
  height = 28,
  fill = true,
  large = false,
}: {
  label: string;
  onPress?: () => void;
  primary?: boolean;
  height?: number;
  /** Stretch to share a row with a sibling (profile). Off for fixed-width buttons in lists. */
  fill?: boolean;
  /** Profile header button: 42 tall, radius 20, dark when primary, #F0F0F0 otherwise, Inter 500 13.5. */
  large?: boolean;
}) {
  const on = useSharedValue(primary ? 1 : 0);
  useEffect(() => {
    on.set(withTiming(primary ? 1 : 0, EASE));
  }, [primary, on]);
  // TH: the light header buttons are white with a #D9D9D9 outline (were #F2F2F2 fills)
  const off = large ? colors.bg : GRAY;
  const accent = large ? colors.text : colors.primary;
  const bg = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [off, accent]),
    ...(large ? { borderColor: interpolateColor(on.value, [0, 1], ['#D9D9D9', accent]) } : null),
  }));
  const fg = useAnimatedStyle(() => ({ color: interpolateColor(on.value, [0, 1], [colors.text, '#FFFFFF']) }));

  return (
    <PressableScale onPress={onPress} scaleTo={0.97} haptic style={fill ? styles.buttonWrap : undefined} accessibilityRole="button" accessibilityLabel={label}>
      <Animated.View collapsable={false} style={[styles.button, large ? styles.buttonLarge : { height }, bg]}>
        <RollingLabel text={label} style={[large ? styles.buttonTextLarge : styles.buttonText, fg]} />
      </Animated.View>
    </PressableScale>
  );
}

const TAB_W = 76;
const LIST_X = 111; // list icon centre
const TABS_STEP = 168.5; // list icon centre → heart centre (279.5)
const UNDERLINE_W = 68;

/**
 * List / liked tabs. The block starts at the heart's top edge (design y 390.1, drawn with its stroke): list icon
 * 1.4 lower, 68x1.5 underline at +24.9 on top of the full-width 0.75 hairline at +25.9. In the export the underline
 * sits 6px right of the list icon; here it is centred under the active icon.
 */
export function ProfileTabs({
  tab,
  onChange,
  marginTop,
}: {
  tab: 'posts' | 'liked';
  onChange: (t: 'posts' | 'liked') => void;
  marginTop: number;
}) {
  const x = useSharedValue(tab === 'posts' ? 0 : 1);
  useEffect(() => {
    x.set(withTiming(tab === 'posts' ? 0 : 1, EASE));
  }, [tab, x]);
  const underline = useAnimatedStyle(() => ({ transform: [{ translateX: LIST_X - UNDERLINE_W / 2 + x.value * TABS_STEP }] }));

  return (
    <View style={[styles.tabs, { marginTop }]}>
      <PressableScale onPress={() => onChange('posts')} scaleTo={0.9} style={[styles.tab, { left: LIST_X - TAB_W / 2 }]} accessibilityRole="tab" accessibilityState={{ selected: tab === 'posts' }} accessibilityLabel="Articles">
        <Icon name="profileTabArticles" width={20} height={14} style={{ marginTop: 1.38 }} tintColor={tab === 'posts' ? '#000000' : SUBTLE} />
      </PressableScale>
      <PressableScale onPress={() => onChange('liked')} scaleTo={0.9} style={[styles.tab, { left: LIST_X + TABS_STEP - TAB_W / 2 }]} accessibilityRole="tab" accessibilityState={{ selected: tab === 'liked' }} accessibilityLabel="Liked">
        <Icon name="profileTabLiked" width={20.75} height={17.75} tintColor={tab === 'liked' ? '#000000' : SUBTLE} />
      </PressableScale>
      <View style={styles.hairline} />
      <Animated.View collapsable={false} style={[styles.underline, underline]} />
    </View>
  );
}

/** Article row, 108 apart: 143x90 thumb (r 12) at x 14.5, title Inter 12.75 / 17 (172 wide, 4 lines max) at x 177.6, meta 12 gray, ⋮ (2.5 dots, 5 apart) 18.75 from the right. */
export function ProfilePostRow({ post }: { post: ProfilePost }) {
  // The reader grows its cover out of the thumbnail.
  const thumb = useRef<View>(null);
  const open = () => {
    if (post.articleId) openArticle(post.articleId, thumb.current, post.image, 12);
  };
  return (
    <PressableScale disabled={!post.articleId} onPress={open} scaleTo={0.985} style={styles.post} accessibilityRole="button" accessibilityLabel={post.title}>
      <View ref={thumb} collapsable={false}>
        <Image source={post.image} style={styles.thumb} contentFit="cover" transition={150} />
      </View>
      <View style={styles.postText}>
        <Text style={styles.postTitle} numberOfLines={4}>
          {post.title}
        </Text>
        <Text style={styles.postMeta}>
          {post.likes} likes • {post.timeAgo}
        </Text>
      </View>
      <PressableScale hitSlop={12} scaleTo={0.85} style={styles.more} accessibilityLabel="More">
        <Icon name="dot" width={2.5} height={2.5} />
        <Icon name="dot" width={2.5} height={2.5} />
        <Icon name="dot" width={2.5} height={2.5} />
      </PressableScale>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // Name box top at design y 97.8 (cap top 103.85), avatar top 97.5.
  top: { flexDirection: 'row', paddingLeft: 13, paddingRight: 17 },
  left: { flex: 1, marginRight: 12 },
  avatar: { width: 106, height: 106, borderRadius: 53, marginTop: 14.5, backgroundColor: colors.surfaceSoft },
  name: { marginTop: 14.81, fontFamily: INTER_FAMILIES['800'], fontSize: 26.4, lineHeight: 31, letterSpacing: -0.26, color: colors.text },
  username: { marginTop: 8.55, marginLeft: 1, fontFamily: INTER_FAMILIES['500'], fontSize: 14, lineHeight: 17, color: SUBTLE },
  stats: { flexDirection: 'row', marginTop: 15.67, marginLeft: 2 },
  statValue: { fontFamily: INTER_FAMILIES['700'], fontSize: 14.5, lineHeight: 18, color: colors.text },
  statLabel: { marginTop: 2.55, fontFamily: INTER_FAMILIES['500'], fontSize: 12.6, lineHeight: 15, color: colors.text },
  // AutoLayouted-20: the bio wraps at ~245 ("…cycling again. And" / "money 💴 a bit.")
  bio: { marginTop: 20.9, paddingLeft: 15, width: 260 },
  bioText: { fontFamily: INTER_FAMILIES['400'], fontSize: 12.5, lineHeight: 17.5, color: colors.text },

  buttons: { flexDirection: 'row', marginTop: 22.42, paddingLeft: 13, paddingRight: 17, gap: 16 },
  buttonWrap: { flex: 1 },
  button: { borderRadius: 7, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  buttonLarge: { height: 42, borderRadius: 20, borderWidth: 1 },
  buttonText: { fontSize: 13, lineHeight: 16, fontWeight: '600' },
  buttonTextLarge: { fontFamily: INTER_FAMILIES['500'], fontSize: 13.6, lineHeight: 17 },

  tabs: { height: 26.63 },
  tab: { position: 'absolute', top: 0, width: TAB_W, height: 22, alignItems: 'center' },
  hairline: { position: 'absolute', left: 0, right: 0, top: 25.88, height: 0.75, backgroundColor: '#E9E9E9' },
  underline: { position: 'absolute', left: 0, top: 24.88, width: UNDERLINE_W, height: 1.5, backgroundColor: '#000000' },

  post: { flexDirection: 'row', paddingLeft: 14.5, marginBottom: 18 },
  thumb: { width: 143, height: 90, borderRadius: 12, backgroundColor: colors.surfaceSoft },
  postText: { width: 172, marginLeft: 20.1 },
  postTitle: { fontFamily: INTER_FAMILIES['400'], fontSize: 12.75, lineHeight: 17, color: colors.text },
  postMeta: { marginTop: 4, fontFamily: INTER_FAMILIES['400'], fontSize: 12, lineHeight: 15, color: colors.textSubtle },
  more: { position: 'absolute', right: 18.75, top: 2.25, gap: 2.5, alignItems: 'center' },
});
