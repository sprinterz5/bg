import { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PostCard } from '@/components/post-card';
import { PostingRow } from '@/components/posting-row';
import { PressableScale } from '@/components/pressable-scale';
import { StoriesCard } from '@/components/stories-card';
import { FOLLOWING_STORIES, WELCOME_STORY, type Post } from '@/mock/data';
import { useFeed } from '@/state/feed';
import { colors, fonts } from '@/theme';
import { Text } from '@/components/text';
import { push } from '@/lib/nav';

const STORIES = [WELCOME_STORY, ...FOLLOWING_STORIES];

export default function Home() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const { posts, publishing } = useFeed();

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: Post; index: number }) => (
      <Animated.View entering={FadeInDown.delay(Math.min(index, 4) * 70).duration(380)} layout={LinearTransition.duration(300)}>
        <PostCard post={item} />
      </Animated.View>
    ),
    [],
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Animated.FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <PressableScale haptic onPress={() => push('/story/new')} hitSlop={8} accessibilityLabel="New story" style={styles.headerBtn}>
                <Icon name="plus" width={43} />
              </PressableScale>
              <Text style={styles.logo}>Bookgram</Text>
              <PressableScale haptic onPress={() => push('/notifications')} hitSlop={8} accessibilityLabel="Notifications" style={styles.headerBtn}>
                <Icon name="heartHeader" width={24.3} height={21.3} />
              </PressableScale>
            </View>
            <Animated.View entering={FadeInDown.duration(380)}>
              <StoriesCard stories={STORIES} />
            </Animated.View>
            {publishing ? <PostingRow coverUri={publishing.coverUri} /> : null}
          </>
        }
        ItemSeparatorComponent={Separator}
        ListHeaderComponentStyle={publishing ? styles.postingGap : styles.storiesGap}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} />}
      />
    </View>
  );
}

const Separator = () => <View style={styles.separator} />;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    height: 52,
    marginBottom: 27,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  logo: { fontFamily: fonts.logo, fontSize: 39, lineHeight: 46, color: colors.text, letterSpacing: 0.4 },
  content: { paddingBottom: 24 },
  storiesGap: { marginBottom: 48 },
  postingGap: { marginBottom: 32 },
  separator: { height: 36 },
});
