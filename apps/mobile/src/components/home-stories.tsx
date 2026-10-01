import { Image } from 'expo-image';
import type { Href } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { Story } from '@/mock/data';
import { colors } from '@/theme';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from '@/components/text';
import { push } from '@/lib/nav';

// Frame 1049 home: rings 97.5 (3.25 gradient stroke) every 108 from x 3.75, photo 85 inside a 3px white
// stroke; the username baseline 15.85 under the ring. Watched stories get the grey ring.
const RING = 97.5;
const PHOTO = 85;

export function HomeStories({ stories }: { stories: Story[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {stories.map((s) => (
        <PressableScale
          key={s.id}
          onPress={() => push(`/story/${s.id}` as Href)}
          accessibilityRole="button"
          accessibilityLabel={`${s.author.username} story`}
          style={styles.item}>
          <View style={styles.ring}>
            <Image source={s.image} style={styles.photo} contentFit="cover" transition={150} />
            <Icon name={s.seen ? 'storyRingSeen' : 'storyRing'} width={RING} style={StyleSheet.absoluteFill} />
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {s.author.username}
          </Text>
        </PressableScale>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingLeft: 3.75, paddingRight: 8, gap: 108 - RING },
  item: { width: RING, alignItems: 'center' },
  ring: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  photo: { width: PHOTO, height: PHOTO, borderRadius: PHOTO / 2, backgroundColor: colors.surfaceSoft },
  name: { marginTop: 4.75, maxWidth: RING + 10, fontSize: 11.5, lineHeight: 14, color: colors.text },
});
