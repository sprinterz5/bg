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
const RADIUS = 15;

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
  const name = post.author.name ?? post.author.username.replace(/[_.]+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());
  const toggleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    save();
  };
  // to people in the app (a card in their chat); the sheet's ⋯ / system share stays in the reader
  const share = () => openShare({ id: post.articleId, title: post.title });

  return (
    <Pressable onLongPress={() => setMenu(true)} delayLongPress={350} style={[styles.root, thought ? null : styles.rootPhoto]}>
      <Pressable onPress={() => openProfile(post.author.username)} hitSlop={4} accessibilityRole="link" accessibilityLabel={`${post.author.username} profile`} style={styles.avatar}>
        <AuthorAvatar author={post.author} size={44} />
        <View pointerEvents="none" style={styles.avatarEdge} />
      </Pressable>

      <View style={styles.column}>
        <Pressable onPress={() => openProfile(post.author.username)} style={styles.head}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
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
          {post.caption ? <Text style={[styles.text, thought ? styles.captionGap : styles.captionGapPhoto]}>{withEmoji(post.caption)}</Text> : null}
        </Pressable>

        {post.image ? (
          <PressableScale onPress={openArticle} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={post.title} style={styles.media}>
            <View ref={media} collapsable={false} style={StyleSheet.absoluteFill}>
              <Image source={post.image} recyclingKey={post.id} style={styles.image} contentFit="cover" transition={200} />
            </View>
          </PressableScale>
        ) : null}

        <View style={[styles.actions, thought ? null : styles.actionsPhoto]}>
          {/* an icon with its count is one block; the blocks sit 7 apart */}
          <View style={styles.block}>
            <View style={styles.like} accessibilityLabel="Likes">
              {thought ? (
                <PressableScale onPress={toggleLike} hitSlop={10} accessibilityLabel={liked ? 'Unlike' : 'Like'}>
                  <PopIcon active={liked}>
                    <Icon name={liked ? 'feedLikeFilledInk' : 'feedLikeBlack'} width={19.238} height={16.948} />
                  </PopIcon>
                </PressableScale>
              ) : (
                // not pressable here: an article is liked and commented in the reader, after reading it
                <Icon name={liked ? 'feedLikeFilledInk' : 'feedLikeBlack'} width={19.238} height={16.948} />
              )}
            </View>
            {/* the count rolls to its new value */}
            <View style={styles.countBox}>
              <RollingLabel text={formatCount(likes)} style={[styles.countText, styles.countDark]} />
            </View>
          </View>
          <View style={[styles.block, styles.commentBlock]}>
            <View style={styles.comment} accessibilityLabel="Comments">
              {thought ? (
                <PressableScale onPress={() => openComments(post.articleId)} hitSlop={10} accessibilityLabel="Comments">
                  <Icon name="feedCommentBlack" width={16.5112} height={16.5112} />
                </PressableScale>
              ) : (
                <Icon name="feedCommentBlack" width={16.5112} height={16.5112} />
              )}
            </View>
            <Text style={[styles.count, styles.countDark]}>{formatCount(post.comments + addedComments)}</Text>
          </View>
          <PressableScale onPress={toggleSave} hitSlop={10} accessibilityLabel={saved ? 'Remove bookmark' : 'Bookmark'} style={styles.bookmark}>
            <PopIcon active={saved}>
              <Icon name={saved ? 'feedBookmarkFilledInk' : 'feedBookmarkBlack'} width={13.7406} height={15.2568} />
            </PopIcon>
          </PressableScale>
          <PressableScale onPress={share} hitSlop={10} accessibilityLabel="Share" style={styles.share}>
            <Icon name="feedShareBlack" width={14.6882} height={14.6882} />
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
  root: { paddingTop: 11.91, paddingBottom: 13.3, transform: [{ translateX: -1 }] },
  rootPhoto: { paddingBottom: 11.3 },
  avatar: { position: 'absolute', left: 9.6, top: 15.8, transform: [{ translateX: 3 }, { translateY: -3 }] },
  column: { marginLeft: 62.5},
  head: { height: 19, flexDirection: 'row', alignItems: 'center', paddingRight: 20 },
  name: { flexShrink: 1, fontFamily: INTER_FAMILIES['600'], fontSize: 15, lineHeight: 19, letterSpacing: -0.2, color: '#000000', transform: [{ translateY: -1 }] },
  age: { marginLeft: 3.2, fontFamily: INTER_FAMILIES['400'], fontSize: 13.75, lineHeight: 19, letterSpacing: 0, color: GRAY, opacity: 0.95, transform: [{ translateY: -0.25 }] },
  text: { marginTop: 5, marginRight: 16, fontFamily: INTER_FAMILIES['400'], fontSize: 14.575, lineHeight: 23, letterSpacing: 0.022, color: '#000000'},
  media: { marginTop: 15.8, marginLeft: 0.1, width: 315.5, height: 226.5, borderRadius: RADIUS, overflow: 'hidden', backgroundColor: colors.surfaceSoft },
  image: { width: '100%', height: '100%' },
  emojiBox: { height: 17, justifyContent: 'center' },
  emoji: { fontFamily: Platform.OS === 'ios' ? 'Apple Color Emoji' : 'System', fontSize: 14.7, lineHeight: Platform.OS === 'ios' ? 17 : 23 },
  bubble: { marginTop: 5.44, marginLeft: -0.55, marginRight: 16, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#F0EFED', borderWidth: 1, borderStyle: 'dashed', borderColor: '#B8B8B8', borderRadius: 22, borderTopLeftRadius: 0 },
  bubbleText: { marginTop: -0.5, marginRight: 0, fontSize: 14.575, lineHeight: 26.5, letterSpacing: 0, transform: [{ translateX: -1.5 }, { translateY: -1 }] },
  captionGap: { marginTop: 18 },
  captionGapPhoto: { marginTop: 19.5 },
  avatarEdge: { ...StyleSheet.absoluteFill, borderRadius: 22.25, borderWidth: 0.5, borderColor: '#CCCCCC' },
  // an icon and its count are one block, the blocks 7 apart; the heart starts where the row started
  actions: { height: 18.5, marginTop: 11.4, marginLeft: -3.5, marginRight: 0, paddingLeft: 3.865, flexDirection: 'row', alignItems: 'flex-start', gap: 18, transform: [{ translateX: -1 }, { translateY: 1 }] },
  actionsPhoto: { transform: [{ translateX: -1 }, { translateY: -2 }] },
  // each glyph grew around its centre (heart and comment 15%, save and send 5%); the strokes in the SVGs are 12.5% lighter
  block: { flexDirection: 'row', alignItems: 'flex-start', transform: [{ translateX: 2 }] },
  // the comment block (and with it save and send) sits 2 right of the heart block
  commentBlock: { marginLeft: 5.5},
  like: { marginTop: 0.9047, marginLeft: -1, transform: [{ scale: 0.8835 }] },
  comment: { marginTop: 0.9363, transform: [{ scale: 0.9021 }] },
  bookmark: { marginTop: 1.9475, marginLeft: 5.5, transform: [{ translateX: 2 }, { scale: 0.93 }] },
  share: { marginTop: 2.5125, marginLeft: 9.5, transform: [{ translateX: 3 }, { scale: 0.93 }] },
  count: { marginTop: 2.4, marginLeft: 6.044, fontFamily: INTER_FAMILIES['400'], fontSize: 12.5, lineHeight: 16, color: '#424242'},
  caption: { color: colors.text },
  countDark: { color: '#424242' },
  countBox: { marginTop: 1.9, marginLeft: 3.916, height: 16, overflow: 'hidden' },
  countText: { fontFamily: INTER_FAMILIES['400'], fontSize: 12.5, lineHeight: 16, color: '#424242'},
  separator: { height: 0.5, backgroundColor: '#D9D9D9'},
});
