import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { memo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View, type HostInstance } from 'react-native';

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
const RADIUS = 25;

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
  // A "thought" has no picture: the whole text is on the card, so there is nothing to open and it can be liked and
  // commented right here (an article is liked and commented in the reader, after reading it).
  const thought = !post.image;
  const openArticle = () => {
    if (!thought) openArticleFrom(post.articleId, media.current, post.image, RADIUS);
  };
  const toggleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    like();
  };
  const name = post.author.name ?? post.author.username;
  const toggleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    save();
  };
  // to people in the app (a card in their chat); the sheet's ⋯ / system share stays in the reader
  const share = () => openShare({ id: post.articleId, title: post.title });

  return (
    <Pressable onLongPress={() => setMenu(true)} delayLongPress={350} style={styles.root}>
      <Pressable onPress={() => openProfile(post.author.username)} hitSlop={4} accessibilityRole="link" accessibilityLabel={`${post.author.username} profile`} style={styles.avatar}>
        <AuthorAvatar author={post.author} size={45} />
        <View pointerEvents="none" style={styles.avatarEdge} />
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
          {/* title and caption, a blank line apart */}
          {thought ? (
            // a thought sits in a dashed speech bubble (the corner by the avatar is the tail)
            <View style={styles.bubble}>
              <Text style={[styles.text, styles.bubbleText]}>{withEmoji(post.title)}</Text>
            </View>
          ) : (
            <Text style={styles.text}>{withEmoji(post.title)}</Text>
          )}
          {post.caption ? <Text style={[styles.text, styles.captionGap]}>{withEmoji(post.caption)}</Text> : null}
        </Pressable>

        {post.image ? (
          <PressableScale onPress={openArticle} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={post.title} style={styles.media}>
            <View ref={media} collapsable={false} style={StyleSheet.absoluteFill}>
              <Image source={post.image} recyclingKey={post.id} style={styles.image} contentFit="cover" transition={200} />
            </View>
          </PressableScale>
        ) : null}

        <View style={styles.actions}>
          <View style={styles.like} accessibilityLabel="Likes">
            {thought ? (
              <PressableScale onPress={toggleLike} hitSlop={10} accessibilityLabel={liked ? 'Unlike' : 'Like'}>
                <PopIcon active={liked}>
                  <Icon name={liked ? 'feedLikeFilledInk' : 'feedLikeBlack'} width={16.729} height={14.737} />
                </PopIcon>
              </PressableScale>
            ) : (
              // not pressable here: an article is liked and commented in the reader, after reading it
              <Icon name={liked ? 'feedLikeFilledInk' : 'feedLikeBlack'} width={16.729} height={14.737} />
            )}
          </View>
          {/* the count rolls to its new value */}
          <View style={[styles.countBox, styles.likeCount]}>
            <RollingLabel text={formatCount(likes)} style={[styles.countText, styles.countDark]} />
          </View>
          <View style={styles.comment} accessibilityLabel="Comments">
            {thought ? (
              <PressableScale onPress={() => openComments(post.articleId)} hitSlop={10} accessibilityLabel="Comments">
                <Icon name="feedCommentBlack" width={14.916} height={14.916} />
              </PressableScale>
            ) : (
              <Icon name="feedCommentBlack" width={14.916} height={14.916} />
            )}
          </View>
          <Text style={[styles.count, styles.countDark, styles.commentCount]}>{formatCount(post.comments + addedComments)}</Text>
          <View style={styles.views}>
            {/* drawn at 13×14 (the frame's glyph is 14×15.5) */}
            <Icon name="feedViewsBlack" width={13.374} height={14.22} />
          </View>
          <Text style={[styles.count, styles.countDark, styles.viewsCount]}>{formatCount(post.views ?? post.likes)}</Text>
          <PressableScale onPress={toggleSave} hitSlop={10} accessibilityLabel={saved ? 'Remove bookmark' : 'Bookmark'} style={styles.bookmark}>
            <PopIcon active={saved}>
              <Icon name={saved ? 'feedBookmarkFilledInk' : 'feedBookmarkBlack'} width={14.5} height={16.1} />
            </PopIcon>
          </PressableScale>
          <PressableScale onPress={share} hitSlop={10} accessibilityLabel="Share" style={styles.share}>
            <Icon name="feedShareBlack" width={15.5} height={15.5} />
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

// iOS: an emoji falls back to another font and its run shifts the whole paragraph's first line. Each emoji is its own
// span (on iOS an inline box, so the fallback font never touches the line's metrics) with the line height fixed, so every line of the text keeps the same height.
const EMOJI = /(\p{Extended_Pictographic}\uFE0F?(?:\u200D\p{Extended_Pictographic}\uFE0F?)*)/u;
function withEmoji(s: string) {
  return s.split(EMOJI).map((part, i) => (i % 2 ? (Platform.OS === 'ios' ? <View key={i} style={styles.emojiBox}><Text style={styles.emoji}>{part}</Text></View> : <Text key={i} style={styles.emoji}>{part}</Text>) : part));
}

const styles = StyleSheet.create({
  // name text box 2.14 above the avatar top (ink 280.9 for an avatar at 280)
  root: { paddingTop: 12.91, paddingBottom: 16.8 },
  avatar: { position: 'absolute', left: 13.1, top: 17.3 },
  column: { marginLeft: 66 },
  head: { height: 19, flexDirection: 'row', alignItems: 'center', paddingRight: 20 },
  name: { flexShrink: 1, fontFamily: INTER_FAMILIES['600'], fontSize: 15, lineHeight: 19, color: colors.text },
  handle: { flexShrink: 2, marginLeft: 4, fontFamily: INTER_FAMILIES['400'], fontSize: 15.25, lineHeight: 19, color: GRAY, opacity: 0.95 },
  dot: { width: 2.2, height: 2.2, borderRadius: 1.1, marginLeft: 2, marginTop: 1.3, backgroundColor: GRAY },
  age: { marginLeft: 3.2, fontFamily: INTER_FAMILIES['400'], fontSize: 15.25, lineHeight: 19, color: GRAY, opacity: 0.95 },
  text: { marginTop: 3.44, marginRight: 16, fontFamily: INTER_FAMILIES['400'], fontSize: 14.7, lineHeight: 25, color: colors.text },
  media: { marginTop: 16.3, marginLeft: 0.7, width: 317.5, height: 226.5, borderRadius: RADIUS, overflow: 'hidden', borderWidth: 0.5, borderColor: GRAY, backgroundColor: colors.surfaceSoft },
  image: { width: '100%', height: '100%' },
  emojiBox: { height: 17, justifyContent: 'center' },
  emoji: { fontFamily: Platform.OS === 'ios' ? 'Apple Color Emoji' : 'System', fontSize: 14.7, lineHeight: Platform.OS === 'ios' ? 17 : 23 },
  bubble: { marginTop: 3.44, marginLeft: -1, marginRight: 16, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#F3F3F3', borderWidth: 1, borderStyle: 'dashed', borderColor: '#B8B8B8', borderRadius: 22, borderTopLeftRadius: 0 },
  bubbleText: { marginTop: 0, marginRight: 0 },
  captionGap: { marginTop: 23 },
  avatarEdge: { ...StyleSheet.absoluteFill, borderRadius: 22.5, borderWidth: 0.25, borderColor: '#999999' },
  actions: { height: 18.5, marginTop: 11.9, marginLeft: -0.75, marginRight: 0 },
  // 15% smaller than the frame's 21×18.5, same line weight (stroke 2.12 in the SVG), centred where it was
  like: { position: 'absolute', left: 1.865, top: 2.26 },
  comment: { position: 'absolute', left: 93.13, top: 1.93 },
  views: { position: 'absolute', left: 181.04, top: 1.64 },
  bookmark: { position: 'absolute', left: 265.3, top: 0.6 },
  share: { position: 'absolute', left: 298.3, top: 1.2 },
  count: { position: 'absolute', top: 2.4, fontFamily: INTER_FAMILIES['400'], fontSize: 12.9, lineHeight: 16, color: INK },
  caption: { color: colors.text },
  countDark: { color: '#424242' },
  countBox: { position: 'absolute', top: 1.9, height: 16, overflow: 'hidden' },
  countText: { fontFamily: INTER_FAMILIES['400'], fontSize: 12.9, lineHeight: 16, color: INK },
  likeCount: { left: 23.26 },
  commentCount: { left: 114.84 },
  viewsCount: { left: 200.46 }, // TH(2): 3K, bookmark and share 1 further left
  separator: { height: 0.5, backgroundColor: '#E9E9E9' },
});
