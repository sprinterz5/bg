import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library/legacy';
import { push } from '@/lib/nav';

/**
 * Opens the design's own "Choose a cover" grid when the photo library is readable.
 * Expo Go on Android cannot get full library access, so it falls back to the system picker.
 */
export async function pickCover(onPicked: (uri: string) => void) {
  try {
    const permission = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
    if (permission.granted) {
      push('/cover-picker');
      return;
    }
  } catch {
    // fall through to the system picker
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [390, 208],
    quality: 0.85,
  });
  if (!result.canceled && result.assets[0]) onPicked(result.assets[0].uri);
}
