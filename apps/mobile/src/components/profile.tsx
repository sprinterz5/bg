import { Image } from 'expo-image';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Animated, { Easing, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AnimatedText, Text } from '@/components/text';
import type { ProfilePost } from '@/mock/data';
import { colors, motion } from '@/theme';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { push } from '@/lib/nav';

// Figma 3167:1542 (other user) and 3169:1832 (own, empty). Header centre at design y 75.
export const PROFILE_HEADER_H = 56;
const GRAY = '#EFF3F4';
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

/** Avatar 90 at x 11, name + three stat columns at x 131 / 207 / 297, bio below. */
export function ProfileSummary({ username, name, avatar, articles, followers, following, bio }: SummaryProps) {
  const openList = (kind: 'followers' | 'following') =>
    push(
      kind === 'followers'
        ? { pathname: '/user/[username]/followers', params: { username } }
        : { pathname: '/user/[username]/following', params: { username } },
    );

  return (
    <View>
      <View style={styles.top}>
        {avatar ? (
          <Image source={avatar} style={styles.avatar} transition={150} />
        ) : (
          <Icon name="avatarPlaceholder" width={90} style={styles.avatar} />
        )}
        <View style={styles.right}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.stats}>
            <Stat value={String(articles)} label="Articles" width={75} />
            <Stat value={followers} label="Followers" width={90} onPress={() => openList('followers')} />
            <Stat value={String(following)} label="Following" onPress={() => openList('following')} />
          </View>
        </View>
      </View>
      {bio.length ? (
        <View style={styles.bio}>
          {bio.map((line) => (
            <Text key={line} style={styles.bioText}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}
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

/** Two equal buttons (Follow/Message, Share/Edit profile): 28–30 tall, 11px apart and from the edges. */
export function ProfileButtons({ children, spaced }: { children: ReactNode; spaced: boolean }) {
  return <View style={[styles.buttons, { marginTop: spaced ? 17 : 28 }]}>{children}</View>;
}

export function ProfileButton({
  label,
  onPress,
  primary,
  height = 28,
  fill = true,
}: {
  label: string;
  onPress?: () => void;
  primary?: boolean;
  height?: number;
  /** Stretch to share a row with a sibling (profile). Off for fixed-width buttons in lists. */
  fill?: boolean;
}) {
  const on = useSharedValue(primary ? 1 : 0);
  useEffect(() => {
    on.value = withTiming(primary ? 1 : 0, EASE);
  }, [primary, on]);
  const bg = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(on.value, [0, 1], [GRAY, colors.primary]) }));
  const fg = useAnimatedStyle(() => ({ color: interpolateColor(on.value, [0, 1], [colors.text, '#FFFFFF']) }));

  return (
    <PressableScale onPress={onPress} scaleTo={0.97} haptic style={fill ? styles.buttonWrap : undefined} accessibilityRole="button" accessibilityLabel={label}>
      <Animated.View style={[styles.button, { height }, bg]}>
        <AnimatedText style={[styles.buttonText, fg]}>{label}</AnimatedText>
      </Animated.View>
    </PressableScale>
  );
}

/** List / liked tabs: icons centred at x 100 and 280, 38px underline, hairline below. */
export function ProfileTabs({ tab, onChange }: { tab: 'posts' | 'liked'; onChange: (t: 'posts' | 'liked') => void }) {
  const x = useSharedValue(tab === 'posts' ? 0 : 1);
  useEffect(() => {
    x.value = withTiming(tab === 'posts' ? 0 : 1, EASE);
  }, [tab, x]);
  const underline = useAnimatedStyle(() => ({ transform: [{ translateX: 81 + x.value * 180 }] }));

  return (
    <View style={styles.tabs}>
      <PressableScale onPress={() => onChange('posts')} scaleTo={0.9} style={[styles.tab, { left: 62 }]} accessibilityRole="tab" accessibilityState={{ selected: tab === 'posts' }} accessibilityLabel="Articles">
        <Icon name="profileTabArticles" width={20} height={14} style={{ marginTop: 2 }} tintColor={tab === 'posts' ? colors.text : colors.textSubtle} />
      </PressableScale>
      <PressableScale onPress={() => onChange('liked')} scaleTo={0.9} style={[styles.tab, { left: 242 }]} accessibilityRole="tab" accessibilityState={{ selected: tab === 'liked' }} accessibilityLabel="Liked">
        <Icon name="postLike" width={21} height={19} tintColor={tab === 'liked' ? colors.text : colors.textSubtle} />
      </PressableScale>
      <Animated.View style={[styles.underline, underline]} />
    </View>
  );
}

/** Figma list row: 142x90 thumb, title 14/15.5 (4 lines max), meta 12 gray, ⋮ on the right. */
export function ProfilePostRow({ post }: { post: ProfilePost }) {
  const open = post.articleId ? () => push({ pathname: '/article/[id]', params: { id: post.articleId! } }) : undefined;
  return (
    <PressableScale disabled={!open} onPress={open} scaleTo={0.985} style={styles.post} accessibilityRole="button" accessibilityLabel={post.title}>
      <Image source={post.image} style={styles.thumb} contentFit="cover" transition={150} />
      <View style={styles.postText}>
        <Text style={styles.postTitle} numberOfLines={4}>
          {post.title}
        </Text>
        <Text style={styles.postMeta}>
          {post.likes} likes • {post.timeAgo}
        </Text>
      </View>
      <PressableScale hitSlop={12} scaleTo={0.85} style={styles.more} accessibilityLabel="More">
        <Icon name="dot" width={3} />
        <Icon name="dot" width={3} />
        <Icon name="dot" width={3} />
      </PressableScale>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', paddingLeft: 11, marginTop: 12 },
  avatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: colors.surfaceSoft },
  right: { marginLeft: 30, paddingTop: 3 },
  name: { fontSize: 15, lineHeight: 18, fontWeight: '600', color: colors.text },
  stats: { flexDirection: 'row', marginTop: 14 },
  statValue: { fontSize: 15, lineHeight: 18, fontWeight: '600', color: colors.text },
  statLabel: { fontSize: 13, lineHeight: 16, color: colors.text, marginTop: -1 },
  bio: { marginTop: 16, paddingHorizontal: 12 },
  bioText: { fontSize: 13, lineHeight: 15.5, color: colors.text },

  buttons: { flexDirection: 'row', paddingHorizontal: 11, gap: 11 },
  buttonWrap: { flex: 1 },
  button: { borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 13, lineHeight: 16, fontWeight: '600' },

  tabs: {
    height: 26,
    marginTop: 43,
    borderBottomWidth: 1,
    borderBottomColor: '#F7F9F9',
  },
  tab: { position: 'absolute', top: 0, width: 76, height: 22, alignItems: 'center' },
  underline: { position: 'absolute', left: 0, bottom: 0, width: 38, height: 2, borderRadius: 1, backgroundColor: colors.text },

  post: { flexDirection: 'row', paddingLeft: 11, paddingRight: 16, marginBottom: 16 },
  thumb: { width: 142, height: 90, borderRadius: 10, backgroundColor: colors.surfaceSoft },
  postText: { flex: 1, marginLeft: 19, paddingRight: 10 },
  postTitle: { fontSize: 14, lineHeight: 15.5, color: colors.text },
  postMeta: { fontSize: 12, lineHeight: 15, color: colors.textSubtle, marginTop: 6 },
  more: { paddingTop: 4, gap: 1.5, alignItems: 'center' },
});
