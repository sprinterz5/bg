import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { PROFILE_HEADER_H, ProfileButton, ProfileButtons, ProfileSummary, ProfileTabs } from '@/components/profile';
import { Text } from '@/components/text';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

// Figma 3169:1832 — own profile, nothing posted yet: "+" · username · settings, Share / Edit profile, empty-state cards.
export default function Profile() {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const [tab, setTab] = useState<'posts' | 'liked'>('posts');
  if (!user) return null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <PressableScale onPress={() => router.navigate('/create')} hitSlop={8} scaleTo={0.88} accessibilityLabel="New article" style={styles.plus}>
          <Icon name="plus" width={43} />
        </PressableScale>
        <Text style={styles.title} numberOfLines={1}>
          {user.username}
        </Text>
        <PressableScale hitSlop={10} scaleTo={0.88} accessibilityLabel="Settings" style={styles.settings}>
          <Icon name="profileSettings" width={24} height={25} />
        </PressableScale>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <ProfileSummary
          username={user.username}
          name={user.name}
          avatar={user.avatarUri ? { uri: user.avatarUri } : null}
          articles={0}
          followers="0"
          following={0}
          bio={[]}
        />
        <ProfileButtons spaced={false}>
          <ProfileButton label="Share" height={30} />
          <ProfileButton label="Edit profile" height={30} />
        </ProfileButtons>
        <ProfileTabs tab={tab} onChange={setTab} />

        {tab === 'posts' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards} style={styles.cardsScroll}>
            <EmptyCard icon="profileEmptyBio" text="Dare to tell people about yourself a bit" action="Add bio" />
            <EmptyCard icon="profileEmptyWrite" text="Write your first article on your favourite topic" action="Write it" onPress={() => router.navigate('/create')} />
          </ScrollView>
        ) : null}
      </ScrollView>
    </View>
  );
}

// 210x227 card, 67px icon circle 15 from the top, gray 12.5/15 text, 104x28 blue button 18 from the bottom.
function EmptyCard({ icon, text, action, onPress }: { icon: IconName; text: string; action: string; onPress?: () => void }) {
  return (
    <View style={styles.card}>
      <Icon name={icon} width={70} height={69} />
      <Text style={styles.cardText}>{text}</Text>
      <PressableScale haptic onPress={onPress} scaleTo={0.95} style={styles.cardButton} accessibilityRole="button">
        <Text style={styles.cardButtonText}>{action}</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { height: PROFILE_HEADER_H, alignItems: 'center', justifyContent: 'center' },
  plus: { position: 'absolute', left: 10, top: (PROFILE_HEADER_H - 43) / 2 },
  title: { maxWidth: 240, fontSize: 21, lineHeight: 26, fontWeight: '700', color: colors.text },
  settings: { position: 'absolute', right: 16, top: (PROFILE_HEADER_H - 25) / 2 - 1 },

  cardsScroll: { marginTop: 20 },
  cards: { paddingHorizontal: 11, gap: 13 },
  card: {
    width: 210,
    height: 227,
    borderWidth: 1,
    borderColor: '#F7F9F9',
    borderRadius: 4,
    alignItems: 'center',
    paddingTop: 14,
  },
  cardText: { marginTop: 18, paddingHorizontal: 22, textAlign: 'center', fontSize: 12.5, lineHeight: 15, color: colors.textSubtle },
  cardButton: {
    position: 'absolute',
    bottom: 18,
    width: 104,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardButtonText: { fontSize: 13, lineHeight: 16, fontWeight: '600', color: '#FFFFFF' },
});
