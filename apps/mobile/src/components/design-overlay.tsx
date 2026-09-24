import { Image } from 'expo-image';
import { usePathname } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';

// Dev-only "pixel perfect" check: a three-finger tap shows the Figma frame of the current screen on top
// of the app. Frames are 2x renders of the section export, served by the dev server (not bundled).
const FRAMES_URL = 'https://31.220.92.154/design/frames/';

const ROUTES: [RegExp, string[]][] = [
  [/^\/$/, ['home', 'home-scrolled', 'home-posting']],
  [/^\/article\//, ['reader-page-1', 'reader-page-2']],
  [/^\/create$/, ['create-empty', 'create-with-cover']],
  [/^\/new-article$/, ['new-article', 'new-article-typing']],
  [/^\/search$/, ['explore', 'search-empty', 'search-suggestions', 'search-suggestions-articles', 'search-profiles', 'search-articles']],
  [/^\/user\/[^/]+\/followers$/, ['followers']],
  [/^\/user\/[^/]+\/following$/, ['following']],
  [/^\/user\/[^/]+$/, ['user-profile']],
  [/^\/profile$/, ['own-profile']],
  [/^\/chat$/, ['chat']],
  [/^\/welcome$/, ['welcome']],
  [/^\/name$/, ['name-empty', 'name-filled']],
  [/^\/username$/, ['username-empty', 'username-filled', 'username-taken']],
  [/^\/password$/, ['password-empty', 'password-filled']],
  [/^\/password-confirm$/, ['password-confirm']],
  [/^\/avatar$/, ['avatar-empty', 'avatar-selected']],
  [/^\/interests$/, ['interests-empty', 'interests-selected']],
  [/^\/ready$/, ['splash']],
];
const ALL = ROUTES.flatMap(([, f]) => f);
const OPACITIES = [0.5, 0.3, 0.7, 1];

export function DesignOverlay({ children }: { children: ReactNode }) {
  return __DEV__ ? <DevOverlay>{children}</DevOverlay> : <>{children}</>;
}

function DevOverlay({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const tap = useMemo(
    () =>
      Gesture.Tap()
        .minPointers(3)
        .runOnJS(true)
        .onEnd((_e, ok) => ok && setVisible((v) => !v)),
    [],
  );

  return (
    <GestureDetector gesture={tap}>
      <View style={styles.root} collapsable={false}>
        {children}
        {visible ? <Overlay onClose={() => setVisible(false)} /> : null}
      </View>
    </GestureDetector>
  );
}

function Overlay({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const frames = useMemo(() => ROUTES.find(([re]) => re.test(pathname))?.[1] ?? ALL, [pathname]);
  const [index, setIndex] = useState(0);
  const [opacity, setOpacity] = useState(0);
  const [peek, setPeek] = useState(false);
  const [barTop, setBarTop] = useState(false);
  const frame = frames[index % frames.length];
  const step = (d: number) => setIndex((i) => (i + d + frames.length) % frames.length);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Design y maps to insets.top + (y - 47), x is 1:1 — the same rule the screens are built with. */}
      <Image
        source={{ uri: FRAMES_URL + frame + '.jpg' }}
        style={[styles.frame, { top: insets.top - 47, opacity: peek ? 0 : OPACITIES[opacity] }]}
        contentFit="fill"
        cachePolicy="memory-disk"
        pointerEvents="none"
      />
      <View style={[styles.bar, barTop ? { top: insets.top + 4 } : { bottom: insets.bottom + 4 }]}>
        <Btn label="‹" onPress={() => step(-1)} />
        <Pressable
          onPressIn={() => setPeek(true)}
          onPressOut={() => setPeek(false)}
          onLongPress={() => setBarTop((v) => !v)}
          delayLongPress={600}
          style={styles.name}>
          <Text style={styles.text} numberOfLines={1}>
            {frame} {frames.length > 1 ? `${(index % frames.length) + 1}/${frames.length}` : ''}
          </Text>
        </Pressable>
        <Btn label="›" onPress={() => step(1)} />
        <Btn label={`${Math.round(OPACITIES[opacity] * 100)}%`} onPress={() => setOpacity((o) => (o + 1) % OPACITIES.length)} />
        <Btn label="×" onPress={onClose} />
      </View>
    </View>
  );
}

function Btn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.btn}>
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  frame: { position: 'absolute', left: 0, width: 390, height: 844 },
  bar: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(15,20,25,0.85)',
  },
  btn: { minWidth: 30, height: 30, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  name: { maxWidth: 170, height: 30, paddingHorizontal: 6, justifyContent: 'center' },
  text: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
});
