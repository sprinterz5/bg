import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { FeedPost } from '@/components/feed-post';
import { PostingRow } from '@/components/posting-row';
import { PressableScale } from '@/components/pressable-scale';
import { HomeStories } from '@/components/home-stories';
import { HOME_STORIES, type Post } from '@/mock/data';
import { useFeed } from '@/state/feed';
import { colors, fonts } from '@/theme';
import { Text } from '@/components/text';
import { push } from '@/lib/nav';

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
        <FeedPost post={item} />
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
              <PressableScale haptic onPress={() => push('/story/new')} hitSlop={12} accessibilityLabel="New story" style={styles.plus}>
                <Icon name="homePlus" width={21} />
              </PressableScale>
              <Text style={styles.logo}>Smarts</Text>
              <PressableScale haptic onPress={() => push('/notifications')} hitSlop={10} accessibilityLabel="Notifications" style={styles.bell}>
                <Icon name="homeBell" width={20} height={23} />
              </PressableScale>
            </View>
            <Animated.View collapsable={false} entering={FadeInDown.duration(380)}>
              <HomeStories stories={HOME_STORIES} />
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
  // Frame 1049 home (status bar 47): plus 21 at (14, 64), "Smarts" (Caveat 36.5) centred 3px left of the
  // screen centre on y 73.2, bell 20x23 at (351, 62.8); story rings start at y 109.75; first avatar at 242.25.
  header: { height: 62.75, alignItems: 'center' },
  plus: { position: 'absolute', left: 14, top: 17 },
  bell: { position: 'absolute', left: 351, top: 15.8 },
  logo: { marginTop: 7.2, fontFamily: fonts.logo, fontSize: 36.5, lineHeight: 38, color: colors.text, paddingHorizontal: 8, transform: [{ translateX: -3.1 }] },
  fade: { position: 'absolute', top: 0, left: 0, right: 0 },
  content: { paddingBottom: 24 },
  storiesGap: { marginBottom: 16.25 },
  postingGap: { marginBottom: 32 },
  separator: { height: 29.95 },
});
