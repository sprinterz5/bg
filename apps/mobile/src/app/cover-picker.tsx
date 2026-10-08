import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library/legacy';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { Text } from '@/components/text';
import { backWhenReady } from '@/lib/nav';
import { deliverCover, pickCoverWithSystemPicker } from '@/lib/pick-cover';

// Frame 1198 "Choose a cover": black screen, ✕ and the title on top, the album ("Recents ›") over a 3-column
// grid of 129x230 tiles 1.5 apart (the photo fitted in the middle over a dark band and a grey-to-black fade),
// the chosen tile dimmed with a blue check, and a round → button (grey until a photo is chosen) at the bottom
// right. y values are from the bottom of the status bar (design y - 47).
const TILE_W = 129;
const TILE_H = 230;
const GAP = 1.5;
const PAGE = 60;
const BLUE = '#455DFF';

type Album = { id: string | null; title: string };
const RECENTS: Album = { id: null, title: 'Recents' };

export default function CoverPicker() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tileW = (width - GAP * 2) / 3;
  const tileH = (TILE_H * tileW) / TILE_W;
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [selected, setSelected] = useState<MediaLibrary.Asset | null>(null);
  const [album, setAlbum] = useState<Album>(RECENTS);
  const [albums, setAlbums] = useState<Album[] | null>(null);
  const [albumsOpen, setAlbumsOpen] = useState(false);
  const cursor = useRef<{ after?: string; hasNext: boolean; loading: boolean }>({ hasNext: true, loading: false });
  const [ready, setReady] = useState(false);

  // No library access (refused, or Expo Go on Android): the system picker instead.
  const fallBack = useCallback(() => {
    backWhenReady();
    setTimeout(() => pickCoverWithSystemPicker(), 450);
  }, []);

  const load = useCallback(async (albumId: string | null, reset: boolean) => {
    const c = cursor.current;
    if (c.loading || (!reset && !c.hasNext)) return;
    c.loading = true;
    try {
      const page = await MediaLibrary.getAssetsAsync({
        first: PAGE,
        after: reset ? undefined : c.after,
        mediaType: MediaLibrary.MediaType.photo,
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        ...(albumId ? { album: albumId } : {}),
      });
      c.after = page.endCursor;
      c.hasNext = page.hasNextPage;
      setAssets((a) => (reset ? page.assets : [...a, ...page.assets]));
    } finally {
      c.loading = false;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const perm = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
        if (!alive) return;
        if (!perm.granted) return fallBack();
        setReady(true);
        await load(null, true);
      } catch {
        if (alive) fallBack();
      }
    })();
    return () => {
      alive = false;
    };
  }, [fallBack, load]);

  const chooseAlbum = (a: Album) => {
    setAlbumsOpen(false);
    if (a.id === album.id) return;
    setAlbum(a);
    setSelected(null);
    cursor.current = { hasNext: true, loading: false };
    load(a.id, true).catch(() => {});
  };

  const openAlbums = () => {
    setAlbumsOpen((v) => !v);
    if (albums) return;
    MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true })
      .then((list) =>
        setAlbums([RECENTS, ...list.filter((a) => a.assetCount > 0).map((a) => ({ id: a.id, title: a.title }))]),
      )
      .catch(() => setAlbums([RECENTS]));
  };

  const next = async () => {
    if (!selected) return;
    // iOS gives ph:// ids: the composer and the upload need a file.
    const info = await MediaLibrary.getAssetInfoAsync(selected).catch(() => null);
    deliverCover(info?.localUri ?? selected.uri);
    backWhenReady();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <PressableScale onPress={() => backWhenReady()} hitSlop={14} scaleTo={0.85} accessibilityLabel="Close" style={styles.close}>
          <Icon name="coverClose" width={18} />
        </PressableScale>
        <Text style={styles.title}>Choose a cover</Text>
      </View>

      <Pressable onPress={openAlbums} hitSlop={10} style={styles.album} accessibilityRole="button" accessibilityLabel={`Album: ${album.title}`}>
        <Text style={styles.albumText} numberOfLines={1}>
          {album.title}
        </Text>
        <Icon name="coverChevron" width={7} height={14} style={[styles.chevron, albumsOpen && styles.chevronOpen]} />
      </Pressable>

      {ready ? (
        <FlatList
          style={styles.grid}
          data={assets}
          keyExtractor={(a) => a.id}
          numColumns={3}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={{ gap: GAP, paddingBottom: insets.bottom + 100 }}
          onEndReached={() => load(album.id, false).catch(() => {})}
          onEndReachedThreshold={1}
          initialNumToRender={12}
          renderItem={({ item }) => (
            <Tile asset={item} width={tileW} height={tileH} selected={selected?.id === item.id} onPress={() => setSelected((s) => (s?.id === item.id ? null : item))} />
          )}
        />
      ) : null}

      {albumsOpen && albums ? (
        // Album list over the grid (not in the design: the frame only shows "Recents ›").
        <Animated.View collapsable={false} entering={FadeIn.duration(150)} exiting={FadeOut.duration(120)} style={[styles.albums, { top: insets.top + 124 }]}>
          <FlatList
            data={albums}
            keyExtractor={(a) => a.id ?? 'recents'}
            renderItem={({ item }) => (
              <Pressable onPress={() => chooseAlbum(item)} style={({ pressed }) => [styles.albumRow, pressed && styles.albumRowPressed]}>
                <Text style={[styles.albumRowText, item.id === album.id && styles.albumRowActive]} numberOfLines={1}>
                  {item.title}
                </Text>
              </Pressable>
            )}
          />
        </Animated.View>
      ) : null}

      <PressableScale
        onPress={next}
        disabled={!selected}
        scaleTo={0.92}
        accessibilityRole="button"
        accessibilityLabel="Use this cover"
        style={[styles.next, selected && styles.nextOn, { bottom: Platform.OS === 'android' ? insets.bottom + 16 : 26 }]}>
        <Icon name="coverNext" width={20.8} height={18.66} tintColor={selected ? '#000000' : '#8C8C8C'} />
      </PressableScale>
    </View>
  );
}

function Tile({ asset, width, height, selected, onPress }: { asset: MediaLibrary.Asset; width: number; height: number; selected: boolean; onPress: () => void }) {
  const s = width / TILE_W;
  return (
    <Pressable onPress={onPress} style={{ width, height }} accessibilityRole="imagebutton" accessibilityState={{ selected }}>
      <View style={[styles.band, { height: 73 * s }]} />
      <Icon name="coverTileFade" width={width} height={128 * s} style={[styles.fade, { top: 102 * s }]} />
      <Image source={{ uri: asset.uri }} recyclingKey={asset.id} style={StyleSheet.absoluteFill} contentFit="contain" transition={120} />
      {selected ? (
        <>
          <View style={styles.dim} />
          <View style={[styles.check, { left: 98.5 * s, top: 5 * s }]}>
            <Icon name="coverCheck" width={12.7} height={9.47} />
          </View>
        </>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  // ✕ (18 with its stroke) at (20, 22); "Choose a cover" centred, its line at 20.7.
  header: { height: 60 },
  close: { position: 'absolute', left: 20, top: 22 },
  title: { position: 'absolute', top: 20.7, left: 0, right: 0, textAlign: 'center', fontSize: 16, lineHeight: 20, fontWeight: '600', color: '#FFFFFF' },
  // "Recents" at x 17.4 (line 96.1), the chevron 7x14 at x 90, y 99.5; the grid starts at 140.
  album: { position: 'absolute', left: 16.6, top: 96.1, flexDirection: 'row', alignItems: 'center', maxWidth: 300 },
  albumText: { fontSize: 15.5, lineHeight: 20, fontWeight: '600', color: '#FFFFFF' },
  chevron: { marginLeft: 10.5 },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  grid: { marginTop: 140 - 60 },
  gridRow: { gap: GAP },
  band: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#4F5148' },
  fade: { position: 'absolute', left: 0 },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  check: { position: 'absolute', width: 27, height: 27, borderRadius: 13.5, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center' },
  albums: { position: 'absolute', left: 12, right: 12, maxHeight: 360, borderRadius: 12, backgroundColor: '#1C1C1E', overflow: 'hidden' },
  albumRow: { height: 46, justifyContent: 'center', paddingHorizontal: 16 },
  albumRowPressed: { backgroundColor: '#2C2C2E' },
  albumRowText: { fontSize: 15, lineHeight: 20, color: '#FFFFFF' },
  albumRowActive: { fontWeight: '700' },
  // 51 round at x 315: #DDDDDD with a grey arrow until a photo is chosen, then white with a black one.
  next: { position: 'absolute', right: 24, width: 51, height: 51, borderRadius: 25.5, backgroundColor: '#DDDDDD', alignItems: 'center', justifyContent: 'center' },
  nextOn: { backgroundColor: '#FFFFFF' },
});
