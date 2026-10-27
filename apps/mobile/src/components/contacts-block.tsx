import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';

import { AuthorAvatar } from '@/components/author-row';
import { PressableScale } from '@/components/pressable-scale';
import { RollingLabel } from '@/components/rolling-label';
import { INTER_FAMILIES, Text } from '@/components/text';
import { appearSideways } from '@/lib/appear';
import { allowContacts, useContacts, type ContactPerson } from '@/lib/contacts';
import { openProfile } from '@/lib/nav';
import { setFollow } from '@/lib/users';
import { colors } from '@/theme';

// AutoLayouted-39 (TH(2)), between two posts, from the separator above: "Your contacts" Inter SemiBold 13.7 #999
// (ink 20 under it, x 8.3); cards 172×203 (r 18) #F4F5F5 from x 8, 8 apart, 46 under the separator, scrolling
// sideways; in a card: the avatar 83 (8 from the top), the name Inter Bold 14.2 (ink 105.9), the handle Inter 11.9 #999
// (ink 127.1), Follow 116×31 (r 10) black with Inter SemiBold 12.4 white, 164 down; 20 under the cards the next separator.
// People come from the phone's contacts matched on the backend (lib/contacts). Not designed: before access is given
// the block shows one card asking for it; with no access or no one found it isn't shown (nor the separator above it).
export function ContactsBlock({ separator }: { separator?: ReactNode }) {
  const { status, people } = useContacts();
  if (status !== 'ask' && status !== 'ready') return null;
  return (
    <>
      {separator}
      <View style={styles.root}>
        <Text style={styles.title}>Your contacts</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} decelerationRate="fast" snapToInterval={180}>
          {status === 'ask' ? (
            <Animated.View collapsable={false} exiting={FadeOut.duration(150)}>
              <AskCard />
            </Animated.View>
          ) : (
            people.map((p, i) => (
              <Animated.View key={p.username} collapsable={false} entering={appearSideways(i)}>
                <ContactCard person={p} />
              </Animated.View>
            ))
          )}
        </ScrollView>
      </View>
    </>
  );
}

function AskCard() {
  return (
    <View style={styles.card}>
      <Text style={[styles.name, styles.askTitle]} numberOfLines={1}>
        Find your friends
      </Text>
      <Text style={[styles.handle, styles.askText]} numberOfLines={3}>
        See who from your contacts is already here
      </Text>
      <PressableScale haptic scaleTo={0.95} onPress={allowContacts} style={styles.follow} accessibilityRole="button" accessibilityLabel="Allow access to contacts">
        <Text style={styles.followText}>Allow</Text>
      </PressableScale>
    </View>
  );
}

function ContactCard({ person }: { person: ContactPerson }) {
  // Not designed: Follow turns into an outlined "Following" (tap again to undo).
  const [following, setFollowing] = useState(false);
  const toggle = () => {
    const next = !following;
    setFollowing(next);
    if (person.id) setFollow(person.id, next).catch(() => setFollowing(!next));
  };
  return (
    <View style={styles.card}>
      {/* the card opens the profile; Follow sits beside it, not inside (no button in a button on web) */}
      <Pressable onPress={() => openProfile(person.username)} style={styles.open} accessibilityRole="button" accessibilityLabel={`${person.name ?? person.username} profile`} />
      <View style={styles.avatar} pointerEvents="none">
        <AuthorAvatar author={person} size={83} />
      </View>
      <Text style={styles.name} numberOfLines={1} pointerEvents="none">
        {person.name ?? person.username}
      </Text>
      <Text style={styles.handle} numberOfLines={1} pointerEvents="none">
        {person.username}
      </Text>
      <PressableScale haptic scaleTo={0.95} onPress={toggle} style={[styles.follow, following && styles.following]} accessibilityRole="button">
        <RollingLabel text={following ? 'Following' : 'Follow'} style={[styles.followText, following && styles.followingText]} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingBottom: 20 },
  title: { marginTop: 17.1, marginLeft: 7.4, fontFamily: INTER_FAMILIES['600'], fontSize: 13.7, lineHeight: 16.4, color: '#999999' },
  row: { gap: 8, paddingHorizontal: 8, paddingTop: 12.5 },
  card: { width: 172, height: 203, borderRadius: 18, backgroundColor: '#F4F5F5', alignItems: 'center' },
  open: { position: 'absolute', left: 0, top: 0, right: 0, height: 158 },
  avatar: { marginTop: 8 },
  name: { position: 'absolute', top: 103, left: 8, right: 8, textAlign: 'center', fontFamily: INTER_FAMILIES['700'], fontSize: 14.2, lineHeight: 17, color: colors.text },
  handle: { position: 'absolute', top: 124.7, left: 8, right: 8, textAlign: 'center', fontFamily: INTER_FAMILIES['400'], fontSize: 11.9, lineHeight: 14.3, color: '#999999', opacity: 0.95 },
  follow: { position: 'absolute', top: 164, width: 116, height: 31, borderRadius: 10, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  following: { backgroundColor: '#F4F5F5', borderWidth: 1, borderColor: '#D9D9D9' },
  followText: { fontFamily: INTER_FAMILIES['600'], fontSize: 12.4, lineHeight: 15, color: '#FFFFFF' },
  followingText: { color: colors.text },
  askTitle: { top: 52 },
  askText: { top: 76, left: 18, right: 18, lineHeight: 16 },
});
