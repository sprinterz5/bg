import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { memo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View, type HostInstance } from 'react-native';

import type { Post } from '@/mock/data';
import { colors } from '@/theme';
import { AuthorAvatar } from './author-row';
import { Icon } from './icon';
import { PopIcon } from './pop-icon';
import { PostActions } from './post-actions';
import { RollingLabel } from './rolling-label';
import { PressableScale } from './pressable-scale';
import { INTER_FAMILIES, Text } from '@/components/text';
import { openArticle as openArticleFrom } from '@/lib/article-origin';
import { openProfile } from '@/lib/nav';
import { useReaction } from '@/lib/reactions';
import { report } from '@/lib/moderation';
import { openComments, openShare } from '@/components/share-host';
import { useAddedComments } from '@/components/comments-sheet';

const GRAY = '#999999';
const INK = GRAY; // action icons and counts (asked for #999 again)
const RADIUS = 13.2;

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}K`;
  return String(n);
}

/** "7h" style age: the design's short form; mock posts may still carry "1 day ago". */
function shortAge(ago: string) {
  const m = ago.match(/^(\d+)\s*(second|minute|hour|day|week|month|year)/);
  if (!m) return ago;
  return m[1] + { second: 's', minute: 'm', hour: 'h', day: 'd', week: 'w', month: 'mo', year: 'y' }[m[2]];
}

// AutoLayouted-34 (BG(2)) home post, tweet-like. From the post top (13.05 under the 0.75 #E9E9E9 separator):
// avatar 42 at x 7.5; name Inter Bold 14.7 at x 57.5, "@handle · 7h" Inter 14.6 #999; text Inter 13.8 / 20.5 from
// x 57.5, ~305 wide; picture 325.5×226.5 (r 13.2, #999 0.5 outline) 14.3 under it; the action row 10.4 under the
// picture: like 520, comment 270, views 3K, bookmark, share (all #999, counts Inter 12.35); 16.3 to the separator.
export const FeedPost = memo(function FeedPost({ post, onHide }: { post: Post; onHide: (id: string) => void }) {
  const addedComments = useAddedComments(post.articleId);
  const { liked, saved, likes, toggleLike: like, toggleSave: save } = useReaction(post.articleId, { liked: !!post.liked, saved: !!post.saved, likes: post.likes });
  const [menu, setMenu] = useState(false);
  // The reader grows its cover out of this picture.
  const media = useRef<HostInstance>(null);
  const openArticle = () => openArticleFrom(post.articleId, media.current, post.image, RADIUS);
  const name = post.author.name ?? post.author.username;
  const toggleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    like();
  };
  const toggleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    save();
  };
  // to people in the app (a card in their chat); the sheet's ⋯ / system share stays in the reader
  const share = () => openShare({ id: post.articleId, title: post.title });

  return (
    <Pressable onLongPress={() => setMenu(true)} delayLongPress={350} style={styles.root}>
      <Pressable onPress={() => openProfile(post.author.username)} hitSlop={4} accessibilityRole="link" accessibilityLabel={`${post.author.username} profile`} style={styles.avatar}>
        <AuthorAvatar author={post.author} size={41} />
      </Pressable>

      <View style={styles.column}>
        <Pressable onPress={() => openProfile(post.author.username)} style={styles.head}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.handle} numberOfLines={1}>
            @{post.author.username}
          </Text>
          <View style={styles.dot} />
          <Text style={styles.age}>{shortAge(post.timeAgo)}</Text>
        </Pressable>

        <Pressable onPress={openArticle} accessibilityRole="button">
          {/* title and caption (after a blank line) both #0F1419 */}
          <Text style={styles.text}>
            {post.title}
            {post.caption ? <Text style={styles.caption}>{`\n\n${post.caption}`}</Text> : null}
          </Text>
        </Pressable>

        <PressableScale onPress={openArticle} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={post.title} style={styles.media}>
          <View ref={media} collapsable={false} style={StyleSheet.absoluteFill}>
            <Image source={post.image} recyclingKey={post.id} style={styles.image} contentFit="cover" transition={200} />
          </View>
        </PressableScale>

        <View style={styles.actions}>
          <PressableScale onPress={toggleLike} hitSlop={10} accessibilityLabel={liked ? 'Unlike' : 'Like'} style={styles.like}>
            <PopIcon active={liked}>
              <Icon name={liked ? 'feedLikeFilled' : 'feedLike'} width={21} height={18.5} />
            </PopIcon>
          </PressableScale>
          {/* the count rolls to its new value */}
          <View style={[styles.countBox, styles.likeCount]}>
            <RollingLabel text={formatCount(likes)} style={styles.countText} />
          </View>
          <PressableScale onPress={() => openComments(post.articleId)} hitSlop={10} accessibilityLabel="Comments" style={styles.comment}>
            <Icon name="feedComment" width={16.4} height={16.4} />
          </PressableScale>
          <Text style={[styles.count, styles.commentCount]}>{formatCount(post.comments + addedComments)}</Text>
          <View style={styles.views}>
            {/* drawn at 13×14 (the frame's glyph is 14×15.5) */}
            <Icon name="feedViews" width={14.86} height={15.8} />
          </View>
          <Text style={[styles.count, styles.viewsCount]}>{formatCount(post.views ?? post.likes)}</Text>
          <PressableScale onPress={toggleSave} hitSlop={10} accessibilityLabel={saved ? 'Remove bookmark' : 'Bookmark'} style={styles.bookmark}>
            <PopIcon active={saved}>
              <Icon name={saved ? 'feedBookmarkFilled' : 'feedBookmark'} width={14.5} height={16.1} />
            </PopIcon>
          </PressableScale>
          <PressableScale onPress={share} hitSlop={10} accessibilityLabel="Share" style={styles.share}>
            <Icon name="feedShare" width={15.5} height={15.5} />
          </PressableScale>
        </View>
      </View>

      {/* Not in the design: long press keeps the old card's menu (save / share / not interested / report). */}
      <PostActions
        visible={menu}
        onClose={() => setMenu(false)}
        actions={[
          { label: saved ? 'Remove from saved' : 'Save', onPress: save },
          { label: 'Share', onPress: share },
          { label: 'Not interested', onPress: () => onHide(post.id) },
          { label: 'Report', destructive: true, onPress: () => report('ARTICLE', post.articleId) },
          { label: 'Report', destructive: true, onPress: () => Alert.alert('Thanks for letting us know', 'We will look at this post.') },
        ]}
      />
    </Pressable>
  );
});

// The separator between posts (and the top padding of the next one) is part of the list: see FEED_SEPARATOR.
export const FeedSeparator = () => <View style={styles.separator} />;

const styles = StyleSheet.create({
  // name text box 2.14 above the avatar top (ink 280.9 for an avatar at 280)
  root: { paddingTop: 10.91, paddingBottom: 21.8 },
  avatar: { position: 'absolute', left: 8.5, top: 14.05 },
  column: { marginLeft: 59.5 },
  head: { height: 19, flexDirection: 'row', alignItems: 'center', paddingRight: 20 },
  name: { flexShrink: 1, fontFamily: INTER_FAMILIES['700'], fontSize: 15.4, lineHeight: 19, color: colors.text },
  handle: { flexShrink: 2, marginLeft: 4, fontFamily: INTER_FAMILIES['400'], fontSize: 15.4, lineHeight: 19, color: GRAY, opacity: 0.95 },
  dot: { width: 2.2, height: 2.2, borderRadius: 1.1, marginLeft: 2, marginTop: 1.3, backgroundColor: GRAY },
  age: { marginLeft: 3.2, fontFamily: INTER_FAMILIES['400'], fontSize: 15.4, lineHeight: 19, color: GRAY, opacity: 0.95 },
  text: { marginTop: 1.94, marginRight: 16, fontFamily: INTER_FAMILIES['400'], fontSize: 14.9, lineHeight: 21.7, color: colors.text },
  media: { marginTop: 14.3, marginLeft: 0.7, width: 323.5, height: 226.5, borderRadius: RADIUS, overflow: 'hidden', borderWidth: 0.5, borderColor: GRAY, backgroundColor: colors.surfaceSoft },
  image: { width: '100%', height: '100%' },
  actions: { height: 18.5, marginTop: 10.9, marginLeft: 1 },
  like: { position: 'absolute', left: -1.5, top: 0 },
  comment: { position: 'absolute', left: 91.9, top: 0.7 },
  views: { position: 'absolute', left: 180.3, top: 0.85 },
  bookmark: { position: 'absolute', left: 265.3, top: 0.6 },
  share: { position: 'absolute', left: 301.3, top: 1.2 },
  count: { position: 'absolute', top: 2.4, fontFamily: INTER_FAMILIES['400'], fontSize: 13.25, lineHeight: 16, color: INK },
  caption: { color: colors.text },
  countBox: { position: 'absolute', top: 1.9, height: 16, overflow: 'hidden' },
  countText: { fontFamily: INTER_FAMILIES['400'], fontSize: 13.25, lineHeight: 16, color: INK },
  likeCount: { left: 23.26 },
  commentCount: { left: 114.84 },
  viewsCount: { left: 200.46 }, // TH(2): 3K, bookmark and share 1 further left
  separator: { height: 0.75, backgroundColor: '#E9E9E9' },
});
