import * as ImagePicker from 'expo-image-picker';

import { push } from './nav';

// Cover for a new article: our own "Choose a cover" screen (Frame 1198) over the photo library; the system picker
// when the library can't be read (permission refused, or Expo Go on Android, which has no full media access).
let pending: ((uri: string) => void) | null = null;

export function pickCover(onPicked: (uri: string) => void) {
  pending = onPicked;
  push('/cover-picker');
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
    aspect: [390, 208],
    quality: 0.85,
  });
  if (!result.canceled && result.assets[0]) deliverCover(result.assets[0].uri);
  else pending = null;
}
