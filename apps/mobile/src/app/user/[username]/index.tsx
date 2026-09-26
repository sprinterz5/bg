import { useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { PROFILE_HEADER_H, ProfileButton, ProfileButtons, ProfilePostRow, ProfileSummary, ProfileTabs } from '@/components/profile';
import { Text } from '@/components/text';
import { getProfile, type Profile } from '@/mock/data';
import { loadProfile, setFollow } from '@/lib/users';
import { colors } from '@/theme';
import { back, push } from '@/lib/nav';
import { openDirect } from '@/lib/chat';

// Figma 3167:1542 — someone else's profile: back + username, summary, Follow / Message, article list.
export default function UserProfile() {
  const insets = useSafeAreaInsets();
  const { username } = useLocalSearchParams<{ username: string }>();
  const [profile, setProfile] = useState<Profile>(() => ({ ...getProfile(username ?? ''), posts: [] }));
  // Backend user id; null for mock-only authors (feed is still mock), whose Follow stays local.
  const [userId, setUserId] = useState<string | null>(null);
  const [isMe, setIsMe] = useState(false);
  const [following, setFollowing] = useState(false);
  const [tab, setTab] = useState<'posts' | 'liked'>('posts');

  useEffect(() => {
    let alive = true;
    loadProfile(username ?? '')
      .then((r) => {
        if (!alive) return;
        if (!r) return setProfile(getProfile(username ?? ''));
        setProfile(r.profile);
        setUserId(r.api.id);
        setIsMe(r.api.isMe);
        setFollowing(r.api.isFollowing);
      })
      .catch(() => alive && setProfile(getProfile(username ?? '')));
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
    setFollowing(next);
    if (!userId) return;
    setFollow(userId, next).catch(() => setFollowing(!next));
  };

  const header = (
    <View>
      <ProfileSummary {...profile} />
      <ProfileButtons marginTop={profile.bio.length > 0 ? 17 : 28}>
        {isMe ? null : (
          <>
            <ProfileButton label={following ? 'Following' : 'Follow'} primary={!following} onPress={toggleFollow} />
            <ProfileButton label="Message" onPress={message} />
          </>
        )}
      </ProfileButtons>
      <ProfileTabs tab={tab} onChange={setTab} marginTop={43.125} />
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <PressableScale onPress={() => back()} hitSlop={12} scaleTo={0.85} accessibilityLabel="Back" style={styles.back}>
          <Icon name="searchBack" width={12} height={20} />
        </PressableScale>
        <Text style={styles.title} numberOfLines={1}>
          {profile.username}
        </Text>
      </View>

      <FlatList
        data={tab === 'posts' ? profile.posts : []}
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  // back chevron 12x20 at x 24, username 21 bold at x 64, both centred on design y 75
  header: { height: PROFILE_HEADER_H, flexDirection: 'row', alignItems: 'center', paddingLeft: 24 },
  back: { width: 12, height: 20 },
  title: { marginLeft: 28, marginRight: 24, flex: 1, fontSize: 21, lineHeight: 26, fontWeight: '700', color: colors.text },
  listHeader: { marginBottom: 18 },
});
