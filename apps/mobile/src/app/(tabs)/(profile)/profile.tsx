import { router, useFocusEffect, useScrollToTop } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { PostActions } from '@/components/post-actions';
import { PressableScale } from '@/components/pressable-scale';
import { PROFILE_HEADER_H, ProfileBio, ProfileButton, ProfileButtons, ProfilePostRow, ProfileSummary, ProfileTabs } from '@/components/profile';
import { ProfileButtonsSkeleton, ProfilePostRowSkeleton, ProfileSummarySkeleton } from '@/components/skeleton';
import { INTER_FAMILIES, Text } from '@/components/text';
import { push } from '@/lib/nav';
import { pickStoryPhoto } from '@/lib/pick-cover';
import { deleteAccount, exportMyData, loadProfile } from '@/lib/users';
import type { Profile as ProfileData } from '@/mock/data';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

// Own profile (AutoLayouts export): "+" · settings, summary, Share / Edit profile, bio, articles (empty-state cards from
// Figma 3169:1832 while there are none).
export default function Profile() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useSession();
  const [tab, setTab] = useState<'posts' | 'liked'>('posts');
  const [data, setData] = useState<ProfileData | null>(null);
  // Placeholders only for the first load; later visits refetch behind the shown profile.
  const [loaded, setLoaded] = useState(false);
  // Tapping the Profile tab again scrolls back to the top.
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const username = user?.username;

  // Refetch on every visit so counts and new articles show up.
  useFocusEffect(
    useCallback(() => {
      if (!username) return;
      let alive = true;
      loadProfile(username)
        .then((r) => alive && r && setData(r.profile))
        .catch(() => {})
        .finally(() => alive && setLoaded(true));
      return () => {
        alive = false;
      };
    }, [username]),
  );

  // Account deletion is required by the stores; asked twice since it can't be undone.
  const confirmDelete = () =>
    Alert.alert('Delete account?', 'Your profile, posts, stories and messages will be deleted for good.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteAccount()
            .then(signOut)
            .catch(() => Alert.alert("Couldn't delete the account", 'Check the connection and try again.')),
      },
    ]);

  // The export goes out through the share sheet (save to Files, mail it, ...).
  const downloadData = () =>
    exportMyData()
      .then((data) => Share.share({ title: 'My Thoughts data', message: JSON.stringify(data, null, 2) }))
      .catch(() => Alert.alert("Couldn't export your data", 'Check the connection and try again.'));

  // No settings screen in the design yet: the gear opens a bottom sheet with Log out, the data export and
  // Delete account (an Android alert can't hold more than three buttons).
  const [settings, setSettings] = useState(false);

  if (!user) return null;
  const posts = data?.posts ?? [];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <PressableScale onPress={pickStoryPhoto} hitSlop={8} scaleTo={0.88} accessibilityLabel="New story" style={styles.plus}>
          <Icon name="profilePlus" width={21} height={21} />
        </PressableScale>
        <PressableScale onPress={() => setSettings(true)} hitSlop={10} scaleTo={0.88} accessibilityLabel="Settings" style={styles.settings}>
          <Icon name="profileSettings" width={21.6} height={21.67} />
        </PressableScale>
      </View>

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {!loaded && !data ? (
          <Animated.View collapsable={false} exiting={FadeOut.duration(150)}>
            <ProfileSummarySkeleton />
            <ProfileButtons>
              <ProfileButtonsSkeleton />
            </ProfileButtons>
            <ProfileTabs tab={tab} onChange={setTab} marginTop={TABS_GAP} />
            <View style={styles.posts}>
              <ProfilePostRowSkeleton />
              <ProfilePostRowSkeleton />
            </View>
          </Animated.View>
        ) : (
        <Animated.View collapsable={false} entering={FadeIn.duration(220)}>
        <ProfileSummary
          username={user.username}
          name={data?.name ?? user.name}
          avatar={user.avatarUri ? { uri: user.avatarUri } : null}
          articles={data?.articles ?? 0}
          followers={data?.followers ?? '0'}
          following={data?.following ?? 0}
        />
        <ProfileButtons>
          <ProfileButton large label="Share" />
          <ProfileButton large label="Edit profile" onPress={() => push('/edit-profile')} />
        </ProfileButtons>
        <ProfileBio bio={data?.bio ?? []} />
        <ProfileTabs tab={tab} onChange={setTab} marginTop={data?.bio?.length ? TABS_GAP : TABS_GAP_NO_BIO} />

        {tab === 'posts' && posts.length ? (
          <View style={styles.posts}>
            {posts.map((p) => (
              <ProfilePostRow key={p.id} post={p} mine onDeleted={() => setData((d) => d && { ...d, posts: d.posts.filter((x) => x.id !== p.id), articles: Math.max(0, d.articles - 1) })} />
            ))}
          </View>
        ) : tab === 'posts' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards} style={styles.cardsScroll}>
            <EmptyCard icon="profileEmptyBio" text="Tell people about yourself" action="Add bio" onPress={() => push('/edit-bio')} />
            <EmptyCard icon="profileEmptyWrite" text={'Write your first post\non your favourite topic'} action="Write it" onPress={() => router.navigate('/create')} />
          </ScrollView>
        ) : null}
        </Animated.View>
        )}
      </ScrollView>

      <PostActions
        visible={settings}
        onClose={() => setSettings(false)}
        actions={[
          { label: 'Log out', onPress: signOut },
          { label: 'Download my data', onPress: downloadData },
          { label: 'Delete account', destructive: true, onPress: confirmDelete },
        ]}
      />
    </View>
  );
}

// Everything is centred on the card (in Figma the icon sits 7.9px and the text/button 2.9px left of centre by mistake).
// Line breaks are fixed so Inter on Android wraps like SF Pro in the design.
function EmptyCard({ icon, text, action, onPress }: { icon: IconName; text: string; action: string; onPress?: () => void }) {
  return (
    <View style={styles.card}>
      <Icon name={icon} width={81} height={81} style={styles.cardIcon} />
      <Text style={styles.cardText}>{text}</Text>
      <PressableScale haptic onPress={onPress} scaleTo={0.95} style={styles.cardButton} accessibilityRole="button">
        <Text style={styles.cardButtonText}>{action}</Text>
      </PressableScale>
    </View>
  );
}

// Bio (or buttons) → tabs block (design y 360.9 → 390.1).
const TABS_GAP = 25.7;
// AutoLayouted-22: without a bio the tabs sit 7.5 closer to the buttons.
const TABS_GAP_NO_BIO = 21.7;

// Header (design y 47–83): "+" 21x21 at (14.5, 54), settings gear 21.65x21.67 at (345.5, 52.66).
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { height: PROFILE_HEADER_H, alignItems: 'center', justifyContent: 'center' },
  plus: { position: 'absolute', left: 14.5, top: 7 },
  settings: { position: 'absolute', right: 22.85, top: 5.66 },

  // AutoLayouted-25 (TH(2)): cards 210x231 (r 13) #F4F5F5 from x 14, 17 apart, 26.75 under the tab line; a white circle
  // 80 (1 #999) with the icon at (59.5, 18), text Inter 12.3 / 16 #999 (ink 118.9), a black 104x28 button at (49.5, 189).
  cardsScroll: { marginTop: 26.75 },
  posts: { marginTop: 17.75 },
  cards: { paddingHorizontal: 14, gap: 17 },
  card: { width: 210, height: 231, borderRadius: 13, backgroundColor: '#F4F5F5' },
  cardIcon: { position: 'absolute', left: 59, top: 17.5 },
  cardText: {
    position: 'absolute',
    left: 0,
    right: 6,
    top: 115.9,
    textAlign: 'center',
    fontFamily: INTER_FAMILIES['400'],
    fontSize: 12.3,
    lineHeight: 16,
    color: '#999999',
  },
  cardButton: {
    position: 'absolute',
    left: 49.5,
    top: 189,
    width: 104,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardButtonText: { fontFamily: INTER_FAMILIES['600'], fontSize: 12.3, lineHeight: 16, color: '#FFFFFF' },
});
