import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOutDown, SlideInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { INTER_FAMILIES, Text } from '@/components/text';
import type { Publishing } from '@/state/feed';

// AutoLayouted-40 (TH(2)): a card floating 8 above the tab bar — 372×51 (r 13) #C9C8CC at x 9 with a soft shadow
// (y 1, blur 2, 25%); "Posting..." Inter 14.4 white, ink from (28.3, 725.6); on the right the cover 48×34 (r 5, white
// 1 outline) at half opacity, filled in from the bottom as it uploads (16 of 34 in the frame).
// Not designed: the post's title under the label (so it's clear what is being sent), "Posted ✓" when it's out (tap
// opens it), and on failure "Couldn't post · Tap to retry" with ✕ (puts the post back into the composer).
const LABEL = { upload: 'Posting...', post: 'Posting...', posted: 'Posted', error: "Couldn't post" } as const;
// How far the cover fills in per stage: the upload is the long part; there is no byte progress, it eases towards these.
const FILL = { upload: 0.65, post: 0.92, posted: 1, error: 0 } as const;

type Props = { publishing: Publishing; bottom: number; onRetry: () => void; onCancel: () => void; onOpen: (articleId: string) => void };

export function PostingRow({ publishing: p, bottom, onRetry, onCancel, onOpen }: Props) {
  const progress = useSharedValue(0);
  const { stage } = p;

  useEffect(() => {
    if (stage === 'error') return;
    progress.set(withTiming(FILL[stage], { duration: stage === 'upload' ? 6000 : stage === 'post' ? 1500 : 250, easing: Easing.out(Easing.cubic) }));
  }, [stage, progress]);

  const fillStyle = useAnimatedStyle(() => ({ height: `${progress.get() * 100}%` }));
  const onPress = stage === 'error' ? onRetry : stage === 'posted' && p.articleId ? () => onOpen(p.articleId!) : undefined;
  const sub = stage === 'error' ? 'Tap to retry' : p.title;

  return (
    <Animated.View collapsable={false} entering={SlideInDown.duration(320).easing(Easing.out(Easing.cubic))} exiting={FadeOutDown.duration(250)} style={[styles.card, { bottom }]}>
      <Pressable onPress={onPress} disabled={!onPress} style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={`${LABEL[stage]} ${sub}`} />
      <View style={styles.texts} pointerEvents="none">
        <Animated.View key={stage === 'upload' ? 'post' : stage} entering={FadeIn.duration(200)} style={styles.labelRow}>
          <Text style={styles.label}>{LABEL[stage]}</Text>
          {stage === 'posted' ? <Icon name="coverCheck" width={12.7} height={9.47} style={styles.check} /> : null}
        </Animated.View>
        <Text style={styles.title} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      {stage === 'error' ? (
        <Pressable onPress={onCancel} hitSlop={10} style={styles.cancel} accessibilityRole="button" accessibilityLabel="Discard and edit">
          <Icon name="coverClose" width={12} height={12} />
        </Pressable>
      ) : null}
      <View style={styles.thumb} pointerEvents="none">
        <Image source={p.cover} style={[StyleSheet.absoluteFill, styles.faded]} contentFit="cover" />
        <Animated.View collapsable={false} style={[styles.fill, fillStyle]}>
          <Image source={p.cover} style={styles.fillImage} contentFit="cover" />
        </Animated.View>
        <View style={styles.outline} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 9,
    right: 9,
    height: 51,
    borderRadius: 13,
    backgroundColor: '#C9C8CC',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  // the label keeps the frame's x; with the title under it the pair is centred in the card
  texts: { position: 'absolute', left: 18.2, right: 100, top: 7.5 },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  label: { fontFamily: INTER_FAMILIES['400'], fontSize: 14.4, lineHeight: 17.3, color: '#FFFFFF' },
  check: { marginLeft: 6 },
  title: { marginTop: 1, fontFamily: INTER_FAMILIES['500'], fontSize: 12, lineHeight: 15, color: 'rgba(255,255,255,0.85)' },
  cancel: { position: 'absolute', left: 280, top: 19.5 },
  thumb: { position: 'absolute', left: 311, top: 9, width: 48, height: 34, borderRadius: 5, overflow: 'hidden' },
  faded: { opacity: 0.5 },
  // the uploaded part: the same picture, full strength, from the bottom up
  fill: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  fillImage: { position: 'absolute', left: 0, bottom: 0, width: 48, height: 34 },
  outline: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderRadius: 5, borderWidth: 1, borderColor: '#FFFFFF' },
});
