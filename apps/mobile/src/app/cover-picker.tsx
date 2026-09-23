import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library/legacy';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { useFeed } from '@/state/feed';
import { colors } from '@/theme';
import { Text } from '@/components/text';
import { back } from '@/lib/nav';

// Figma 3120:1438 (nothing selected) and 3123:1812 (selected). Cells 129x230, gap 1.5.
const GAP = 1.5;
const CELL_RATIO = 230 / 129;

type Photo = { id: string; uri: string };

export default function CoverPicker() {
  const insets = useSafeAreaInsets();
  // iOS: sits over the home indicator like the design. Android 3-button nav has no indicator, so stay above the bar.
  const nextBottom = Platform.OS === 'android' ? insets.bottom + 16 : Math.max(insets.bottom - 18, 16);
  const { width: W } = useWindowDimensions();
  const { updateDraft } = useFeed();
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [selected, setSelected] = useState<Photo | null>(null);

  const cellW = (W - GAP * 2) / 3;
  const cellH = Math.round(cellW * CELL_RATIO);

  useEffect(() => {
    let alive = true;
    MediaLibrary.getAssetsAsync({
      first: 120,
      mediaType: MediaLibrary.MediaType.photo,
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    })
      .then((page) => alive && setPhotos(page.assets.map((a) => ({ id: a.id, uri: a.uri }))))
      .catch(() => alive && setPhotos([]));
    return () => {
      alive = false;
    };
  }, []);

  const toggle = (photo: Photo) => {
    Haptics.selectionAsync();
    setSelected((s) => (s?.id === photo.id ? null : photo));
  };

  const confirm = async () => {
    if (!selected) return;
    let uri = selected.uri;
    try {
      const info = await MediaLibrary.getAssetInfoAsync(selected.id);
      uri = info.localUri ?? uri;
    } catch {
      // keep the library uri; expo-image can render it
    }
    updateDraft({ coverUri: uri });
    back();
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.titleRow}>
          <PressableScale onPress={() => back()} hitSlop={12} accessibilityLabel="Close" style={styles.close}>
            <Icon name="pickerClose" width={18} />
          </PressableScale>
          <Text style={styles.title}>Choose a cover</Text>
        </View>
        <View style={styles.album}>
          <Text style={styles.albumText}>Recents</Text>
          <Icon name="pickerChevron" width={7} height={14} />
        </View>
      </View>

      {photos === null ? (
        <ActivityIndicator color="#FFFFFF" style={styles.loader} />
      ) : photos.length === 0 ? (
        <Text style={styles.empty}>No photos found</Text>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(p) => p.id}
          numColumns={3}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{ gap: GAP, paddingBottom: insets.bottom + 90 }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          renderItem={({ item, index }) => (
            <PressableScale
              scaleTo={0.97}
              onPress={() => toggle(item)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected?.id === item.id }}
              style={{ width: cellW, height: cellH }}>
              <Animated.View entering={FadeIn.delay(Math.min(index, 12) * 25).duration(250)} style={styles.cell}>
                <Image source={{ uri: item.uri }} style={styles.fill} contentFit="cover" recyclingKey={item.id} transition={120} />
              </Animated.View>
              {selected?.id === item.id ? (
                <Animated.View entering={ZoomIn.springify().damping(14)} exiting={ZoomOut.duration(120)} style={styles.badge}>
                  <Icon name="tick" width={12} />
                </Animated.View>
              ) : null}
            </PressableScale>
          )}
        />
      )}

      <PressableScale
        haptic
        disabled={!selected}
        scaleTo={0.9}
        onPress={confirm}
        accessibilityLabel="Use this cover"
        accessibilityState={{ disabled: !selected }}
        style={[styles.next, { bottom: nextBottom }]}>
        <Icon name={selected ? 'pickerNextActive' : 'pickerNextInactive'} width={51} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  header: { backgroundColor: '#000000' },
  titleRow: { height: 62, alignItems: 'center', justifyContent: 'center' },
  close: { position: 'absolute', left: 21, top: 22, width: 18, height: 18 },
  title: { fontSize: 16, lineHeight: 16, letterSpacing: -0.16, fontWeight: '700', color: '#FFFFFF' },
  album: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, height: 30, marginTop: 29, marginBottom: 19 },
  albumText: { fontSize: 16, lineHeight: 16, letterSpacing: -0.16, fontWeight: '700', color: '#FFFFFF' },
  cell: { flex: 1, backgroundColor: '#1C1C1C' },
  fill: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    top: 6,
    right: 5,
    width: 25,
    height: 25,
    borderRadius: 12.5,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  next: { position: 'absolute', right: 23 },
  loader: { marginTop: 40 },
  empty: { color: '#8C8C8C', textAlign: 'center', marginTop: 40, fontSize: 15 },
});
