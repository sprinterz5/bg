import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { PROFILE_HEADER_H, ProfileButton, ProfileButtons, ProfilePostRow, ProfileSummary, ProfileTabs } from '@/components/profile';
import { Text } from '@/components/text';
import { loadProfile } from '@/lib/users';
import type { Profile as ProfileData } from '@/mock/data';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

// Figma 3169:1832 — own profile, nothing posted yet: "+" · username · settings, Share / Edit profile, empty-state cards.
export default function Profile() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useSession();
  const [tab, setTab] = useState<'posts' | 'liked'>('posts');
  const [data, setData] = useState<ProfileData | null>(null);
  const username = user?.username;

  // Refetch on every visit so counts and new articles show up.
  useFocusEffect(
    useCallback(() => {
      if (!username) return;
      let alive = true;
      loadProfile(username)
        .then((r) => alive && r && setData(r.profile))
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, [username]),
  );

  // No settings screen in the design yet: the gear opens a system sheet with Log out.
  const openSettings = () =>
    Alert.alert(user?.username ?? '', undefined, [
      { text: 'Log out', style: 'destructive', onPress: signOut },
      { text: 'Cancel', style: 'cancel' },
    ]);

  if (!user) return null;
  const posts = data?.posts ?? [];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <PressableScale onPress={() => router.navigate('/create')} hitSlop={8} scaleTo={0.88} accessibilityLabel="New article" style={styles.plus}>
          <Icon name="plus" width={43} />
        </PressableScale>
        <Text style={styles.title} numberOfLines={1}>
          {user.username}
        </Text>
        <PressableScale onPress={openSettings} hitSlop={10} scaleTo={0.88} accessibilityLabel="Settings" style={styles.settings}>
          <Icon name="profileSettings" width={21.6} height={21.67} />
        </PressableScale>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <ProfileSummary
          username={user.username}
          name={data?.name ?? user.name}
          avatar={user.avatarUri ? { uri: user.avatarUri } : null}
          articles={data?.articles ?? 0}
          followers={data?.followers ?? '0'}
          following={data?.following ?? 0}
          bio={data?.bio ?? []}
        />
        <ProfileButtons marginTop={data?.bio.length ? 17 : 28}>
          <ProfileButton label="Share" height={30} />
          <ProfileButton label="Edit profile" height={30} />
        </ProfileButtons>
        <ProfileTabs tab={tab} onChange={setTab} marginTop={43.125} />

        {tab === 'posts' && posts.length ? (
          <View style={styles.posts}>
            {posts.map((p) => (
              <ProfilePostRow key={p.id} post={p} />
            ))}
          </View>
        ) : tab === 'posts' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards} style={styles.cardsScroll}>
            <EmptyCard icon="profileEmptyBio" text={'Dare to tell people about\nyourself a bit'} action="Add bio" />
            <EmptyCard icon="profileEmptyWrite" text={'Write your first article\non your favourite topic'} action="Write it" onPress={() => router.navigate('/create')} />
          </ScrollView>
        ) : null}
      </ScrollView>
    </View>
  );
}

// Card 209.5x225.5 with a centred 0.5 stroke (210x226 outside). Offsets below are from the inner edge.
// Everything is centred on the card (in Figma the icon sits 7.9px and the text/button 2.9px left of centre by mistake).
// Line breaks are fixed so Inter on Android wraps like SF Pro in the design.
function EmptyCard({ icon, text, action, onPress }: { icon: IconName; text: string; action: string; onPress?: () => void }) {
  return (
    <View style={styles.card}>
      <Icon name={icon} width={67} height={67} style={styles.cardIcon} />
      <Text style={styles.cardText}>{text}</Text>
      <PressableScale haptic onPress={onPress} scaleTo={0.95} style={styles.cardButton} accessibilityRole="button">
        <Text style={styles.cardButtonText}>{action}</Text>
      </PressableScale>
    </View>
  );
}

// Header (design y 47–103): plus centred at (31.5, 74.5), settings gear 21.6x21.67 at x 352 / y 62.67,
// username centred 3.15px left of the screen centre (same in the chats frame).
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { height: PROFILE_HEADER_H, alignItems: 'center', justifyContent: 'center' },
  plus: { position: 'absolute', left: 10, top: 6 },
  title: { maxWidth: 240, fontSize: 21, lineHeight: 26, fontWeight: '700', color: colors.text, transform: [{ translateX: -3.15 }] },
  settings: { position: 'absolute', right: 16.4, top: 15.67 },

  cardsScroll: { marginTop: 21 },
  posts: { marginTop: 18 },
  cards: { paddingHorizontal: 11, gap: 13 },
  card: { width: 210, height: 226, borderWidth: 0.5, borderColor: '#EFF3F4', borderRadius: 5 },
  cardIcon: { position: 'absolute', left: 71, top: 14 },
  cardText: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 98.25,
    textAlign: 'center',
    fontSize: 12.5,
    lineHeight: 15,
    color: colors.textSubtle,
  },
  cardButton: {
    position: 'absolute',
    left: 52.5,
    top: 180,
    width: 104,
    height: 28,
    borderRadius: 7,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardButtonText: { fontSize: 13, lineHeight: 16, fontWeight: '600', color: '#FFFFFF' },
});
