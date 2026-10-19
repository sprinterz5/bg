import { useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { PROFILE_HEADER_H, ProfileBio, ProfileButton, ProfileButtons, ProfilePostRow, ProfileSummary, ProfileTabs } from '@/components/profile';
import { ProfileButtonsSkeleton, ProfilePostRowSkeleton, ProfileSummarySkeleton } from '@/components/skeleton';
import { getProfile, type Profile } from '@/mock/data';
import { formatCount, loadProfile, setFollow } from '@/lib/users';
import { colors } from '@/theme';
import { back, push } from '@/lib/nav';
import { openDirect } from '@/lib/chat';

// Someone else's profile (AutoLayouts export): back, summary, Follow / Message, bio, article list.
export default function UserProfile() {
  const insets = useSafeAreaInsets();
  const { username } = useLocalSearchParams<{ username: string }>();
  const [profile, setProfile] = useState<Profile>(() => ({ ...getProfile(username ?? ''), posts: [] }));
  // Backend user id; null for mock-only authors (feed is still mock), whose Follow stays local.
  const [userId, setUserId] = useState<string | null>(null);
  const [isMe, setIsMe] = useState(false);
  const [following, setFollowing] = useState(false);
  // Raw follower count from the backend, so Follow / Unfollow updates the number right away.
  const [followers, setFollowers] = useState<number | null>(null);
  const [tab, setTab] = useState<'posts' | 'liked'>('posts');
  // Placeholders until the backend answers (or the mock profile is used).
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    loadProfile(username ?? '')
      .then((r) => {
        if (!alive) return;
        setLoaded(true);
        if (!r) return setProfile(getProfile(username ?? ''));
        setProfile(r.profile);
        setUserId(r.api.id);
        setIsMe(r.api.isMe);
        setFollowing(r.api.isFollowing);
        setFollowers(r.api._count.followers);
      })
      .catch(() => {
        if (!alive) return;
        setLoaded(true);
        setProfile(getProfile(username ?? ''));
      });
    return () => {
      alive = false;
    };
  }, [username]);

  const message = () => {
    if (!userId) return;
    openDirect(userId)
      .then((c) => push(`/conversation/${c.id}?username=${encodeURIComponent(profile.username)}` as Href))
      .catch(() => {});
  };

  const toggleFollow = () => {
    const next = !following;
    const bump = (d: number) => setFollowers((n) => (n === null ? null : Math.max(0, n + d)));
    setFollowing(next);
    bump(next ? 1 : -1);
    if (!userId) return;
    setFollow(userId, next).catch(() => {
      setFollowing(!next);
      bump(next ? -1 : 1);
    });
  };

  const header = loaded ? (
    <Animated.View collapsable={false} entering={FadeIn.duration(220)}>
      <ProfileSummary {...profile} followers={followers === null ? profile.followers : formatCount(followers)} />
      {isMe ? null : (
        <ProfileButtons>
          <ProfileButton large label={following ? 'Following' : 'Follow'} primary={!following} onPress={toggleFollow} />
          <ProfileButton large label="Message" onPress={message} />
        </ProfileButtons>
      )}
      <ProfileBio bio={profile.bio} />
      <ProfileTabs tab={tab} onChange={setTab} marginTop={profile.bio.length ? TABS_GAP : TABS_GAP_NO_BIO} />
    </Animated.View>
  ) : (
    <Animated.View collapsable={false} exiting={FadeOut.duration(150)}>
      <ProfileSummarySkeleton />
      <ProfileButtons>
        <ProfileButtonsSkeleton />
      </ProfileButtons>
      <ProfileTabs tab={tab} onChange={setTab} marginTop={TABS_GAP} />
      <View style={styles.skeletonPosts}>
        <ProfilePostRowSkeleton />
        <ProfilePostRowSkeleton />
        <ProfilePostRowSkeleton />
      </View>
    </Animated.View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <PressableScale onPress={() => back()} hitSlop={12} scaleTo={0.85} accessibilityLabel="Back" style={styles.back}>
          <Icon name="profileBack" width={10.99} height={18.99} />
        </PressableScale>
      </View>

      <FlatList
        data={loaded && tab === 'posts' ? profile.posts : []}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={header}
        ListHeaderComponentStyle={styles.listHeader}
        renderItem={({ item }) => (
          <Animated.View collapsable={false} entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)}>
            <ProfilePostRow post={item} />
          </Animated.View>
        )}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// Bio (or buttons) → tabs block (design y 360.9 → 390.1).
const TABS_GAP = 25.7;
// AutoLayouted-22: without a bio the tabs sit 7.5 closer to the buttons.
const TABS_GAP_NO_BIO = 21.7;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  skeletonPosts: { marginTop: 18 },
  // back chevron 11x19 at design (15.3, 55.5)
  header: { height: PROFILE_HEADER_H },
  back: { position: 'absolute', left: 15.33, top: 8.51 },
  listHeader: { marginBottom: 17.75 },
});
