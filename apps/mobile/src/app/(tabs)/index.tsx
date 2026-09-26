import { Image } from 'expo-image';
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
      <Animated.View collapsable={false} entering={FadeInDown.delay(Math.min(index, 4) * 70).duration(380)} layout={LinearTransition.duration(300)}>
        <PostCard post={item} />
      </Animated.View>
    ),
    [],
  );

  return (
    <View style={styles.root}>
      <Animated.FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <PressableScale haptic onPress={() => push('/story/new')} hitSlop={8} accessibilityLabel="New story" style={styles.plus}>
                <Icon name="plus" width={43} />
              </PressableScale>
              <Text style={styles.logo}>Bookgram</Text>
              <PressableScale haptic onPress={() => push('/notifications')} hitSlop={8} accessibilityLabel="Notifications" style={styles.bell}>
                <Icon name="headerBell" width={20} height={23} />
              </PressableScale>
            </View>
            <Animated.View collapsable={false} entering={FadeInDown.duration(380)}>
              <StoriesCard stories={STORIES} />
            </Animated.View>
            {publishing ? <PostingRow coverUri={publishing.coverUri} /> : null}
          </>
        }
        ItemSeparatorComponent={Separator}
        ListHeaderComponentStyle={publishing ? styles.postingGap : styles.storiesGap}
        contentContainerStyle={[styles.content, { paddingTop: insets.top }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} colors={[colors.textMuted]} progressViewOffset={insets.top} />}
      />
      {/* Content scrolls under the status bar and fades out there (69px in the frame = status bar + 22). */}
      {/* SVG gradient via expo-image: expo-linear-gradient is not in the Android dev build. */}
      <Image
        pointerEvents="none"
        source={require('@/assets/fade-top.svg')}
        contentFit="fill"
        style={[styles.fade, { height: insets.top + 22 }]}
      />
    </View>
  );
}

const Separator = () => <View style={styles.separator} />;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  // Section 7 home: plus centred at (25.5, 75), logo centred 2.5px left of the screen centre,
  // bell 20x23 centred at (361, 74.8); the first card's avatar is at y 126.4.
  header: { height: 56, marginBottom: 23.4, alignItems: 'center', justifyContent: 'center' },
  plus: { position: 'absolute', left: 3, top: 5.5 },
  bell: { position: 'absolute', right: 19, top: 16.3 },
  logo: { fontFamily: fonts.logo, fontSize: 39, lineHeight: 46, color: colors.text, letterSpacing: 0.4, transform: [{ translateX: -2.5 }] },
  fade: { position: 'absolute', top: 0, left: 0, right: 0 },
  content: { paddingBottom: 24 },
  storiesGap: { marginBottom: 41.8 },
  postingGap: { marginBottom: 32 },
  separator: { height: 37.9 },
});
