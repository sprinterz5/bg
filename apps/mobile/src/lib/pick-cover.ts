import * as ImagePicker from 'expo-image-picker';

/** Cover for a new article: straight from the system photo picker (section 7 dropped the custom "Choose a cover" grid). */
export async function pickCover(onPicked: (uri: string) => void) {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [390, 208],
    quality: 0.85,
  });
  if (!result.canceled && result.assets[0]) onPicked(result.assets[0].uri);
}
