import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { memo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import type { Post } from '@/mock/data';
import { colors, fonts } from '@/theme';
import { AuthorRow } from './author-row';
import { Icon, type IconName } from './icon';
import { LikeButton } from './like-button';
import { PressableScale } from './pressable-scale';
import { Text } from '@/components/text';
import { push } from '@/lib/nav';

function formatCount(n: number) {
  return n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : String(n);
}

export const PostCard = memo(function PostCard({ post }: { post: Post }) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const savePop = useSharedValue(1);

  const pop = (v: typeof savePop) => {
    v.value = withSequence(withSpring(1.28, { damping: 8, stiffness: 400 }), withSpring(1, { damping: 10, stiffness: 300 }));
  };

  const toggleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSaved((v) => !v);
    pop(savePop);
  };

  const saveStyle = useAnimatedStyle(() => ({ transform: [{ scale: savePop.value }] }));
  const openArticle = () => push({ pathname: '/article/[id]', params: { id: post.articleId } });

  return (
    <View style={styles.card}>
      <AuthorRow author={post.author} />

      <PressableScale scaleTo={0.985} onPress={openArticle} accessibilityRole="button" accessibilityLabel={post.title} style={styles.media}>
        <Image source={post.image} style={styles.image} contentFit="cover" transition={200} />
        <View style={styles.titleChip}>
          <Text style={styles.titleText} numberOfLines={2}>
            {post.title}
          </Text>
        </View>
      </PressableScale>

      <View style={styles.actions}>
        <View style={styles.actionsLeft}>
          <LikeButton
            liked={liked}
            onToggle={() => setLiked((v) => !v)}
            count={post.likes + (liked ? 1 : 0)}
            format={formatCount}
            icons={{ off: 'postLike', on: 'postLikeFilled' }}
            width={21}
            height={19}
            gap={5}
            style={styles.like}
            countStyle={styles.count}
          />
          <Action icon="postShare" w={16.5} h={15.5} count={post.shares} onPress={() => {}} label="Share" />
        </View>
        <PressableScale onPress={toggleSave} hitSlop={10} accessibilityLabel={saved ? 'Remove bookmark' : 'Bookmark'} style={styles.bookmark}>
          <Animated.View collapsable={false} style={saveStyle}>
            <Icon name="postBookmark" width={17.75} height={19.75} tintColor={saved ? colors.primary : undefined} />
          </Animated.View>
        </PressableScale>
      </View>

      <View style={styles.captionBlock}>
        <Text style={styles.caption} numberOfLines={3}>
          <Text style={styles.captionUser}>{post.author.username} </Text>
          {post.caption}
        </Text>
        <Text style={styles.time}>{post.timeAgo}</Text>
      </View>
    </View>
  );
});

type ActionProps = {
  icon: IconName;
  w: number;
  h: number;
  count: number;
  onPress: () => void;
  label: string;
  tint?: string;
  pop?: SharedValue<number>;
};

function Action({ icon, w, h, count, onPress, label, tint, pop }: ActionProps) {
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop ? pop.value : 1 }] }));
  return (
    <PressableScale onPress={onPress} hitSlop={8} accessibilityLabel={label} style={styles.action}>
      <Animated.View collapsable={false} style={popStyle}>
        <Icon name={icon} width={w} height={h} tintColor={tint} />
      </Animated.View>
      <Text style={styles.count}>{formatCount(count)}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
// Section 7 (x 534). From the avatar top: media 227 tall at +42.9; action row centred 19.7 below the media;
// caption 10.2 under the row, time 7.6 under the caption. Comment count and the ⋯ menu are gone.
  card: {},
  media: { height: 227, marginTop: 10.9, backgroundColor: colors.surfaceSoft, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  titleChip: {
    position: 'absolute',
    left: 7.5,
    bottom: 5.8,
    width: 263,
    height: 47,
    justifyContent: 'center',
    paddingHorizontal: 7,
    borderRadius: 13.5,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  titleText: { fontFamily: fonts.display, fontSize: 17, lineHeight: 19, color: colors.text },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 22,
    paddingLeft: 11,
    paddingRight: 15.6,
    marginTop: 8.7,
  },
  actionsLeft: { flexDirection: 'row', alignItems: 'center' },
  // share icon starts at x 100.44 whatever the like count is
  like: { width: 89.44 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 7, transform: [{ translateY: -0.3 }] },
  bookmark: { transform: [{ translateY: -1 }] },
  count: { fontSize: 12, fontWeight: '600', color: colors.text },
  captionBlock: { paddingHorizontal: 12, gap: 6.75, marginTop: 10.2 },
  caption: { fontSize: 13, lineHeight: 16, color: colors.text },
  captionUser: { fontWeight: '600' },
  time: { fontSize: 11.5, lineHeight: 16, color: colors.textSubtle },
});
