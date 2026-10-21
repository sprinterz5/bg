import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AuthorAvatar } from '@/components/author-row';
import { PressableScale } from '@/components/pressable-scale';
import { RollingLabel } from '@/components/rolling-label';
import { INTER_FAMILIES, Text } from '@/components/text';
import type { Author } from '@/mock/data';
import { openProfile } from '@/lib/nav';
import { colors } from '@/theme';

// AutoLayouted-39 (TH(2)), between two posts, from the separator above: "Your contacts" Inter SemiBold 13.7 #999
// (ink 20 under it, x 8.3); cards 172×203 (r 18) #F4F5F5 from x 8, 8 apart, 46 under the separator, scrolling
// sideways; in a card: the avatar 83 (8 from the top), the name Inter Bold 14.2 (ink 105.9), the handle Inter 11.9 #999
// (ink 127.1), Follow 116×31 (r 10) black with Inter SemiBold 12.4 white, 164 down; 20 under the cards the next separator.
export function ContactsBlock({ people }: { people: Author[] }) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Your contacts</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} decelerationRate="fast" snapToInterval={180}>
        {people.map((p) => (
          <ContactCard key={p.username} person={p} />
        ))}
      </ScrollView>
    </View>
  );
}

function ContactCard({ person }: { person: Author }) {
  // Not designed: Follow turns into an outlined "Following" (tap again to undo).
  const [following, setFollowing] = useState(false);
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
      <PressableScale haptic scaleTo={0.95} onPress={() => setFollowing((v) => !v)} style={[styles.follow, following && styles.following]} accessibilityRole="button">
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
});
