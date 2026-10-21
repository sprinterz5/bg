import * as ImagePicker from 'expo-image-picker';

import { push } from './nav';

// Cover for a new article: our own "Choose a cover" screen (Frame 1198) over the photo library; the system picker
// when the library can't be read (permission refused, or Expo Go on Android, which has no full media access).
// The same screen picks a story photo, titled "Create a story" (AutoLayouted-4 / -5).
let pending: ((uri: string) => void) | null = null;
let aspect: [number, number] = [390, 208];

export function pickCover(onPicked: (uri: string) => void, opts?: { title?: string; aspect?: [number, number] }) {
  pending = onPicked;
  aspect = opts?.aspect ?? [390, 208];
  push(opts?.title ? `/cover-picker?title=${encodeURIComponent(opts.title)}` : '/cover-picker');
}

/** The crop aspect (w / h) asked for by the current pick. */
export function coverAspect() {
  return aspect[0] / aspect[1];
}

/** Called by the cover screen with the chosen photo. */
export function deliverCover(uri: string) {
  pending?.(uri);
  pending = null;
}

export async function pickCoverWithSystemPicker() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect,
    quality: 0.85,
  });
  if (!result.canceled && result.assets[0]) deliverCover(result.assets[0].uri);
  else pending = null;
}

/** Home "+": the photo first ("Create a story"), then the caption screen once the picker has closed. */
export function pickStoryPhoto() {
  pickCover((uri) => setTimeout(() => push(`/story/new?uri=${encodeURIComponent(uri)}`), 450), { title: 'Create a story', aspect: [9, 16] });
}
