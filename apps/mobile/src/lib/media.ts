import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { api } from './api';

export type MediaKind = 'AVATAR' | 'ARTICLE_COVER' | 'STORY_IMAGE' | 'CHAT_ATTACHMENT';
export type MediaAsset = { id: string; url: string; width: number | null; height: number | null };

// Longest side after resizing. The backend accepts JPEG/PNG/WebP up to 10 MB; photos from the
// gallery can be HEIC or huge, so everything is re-encoded to JPEG first.
const MAX_SIDE: Record<MediaKind, number> = { AVATAR: 640, ARTICLE_COVER: 1600, STORY_IMAGE: 1600, CHAT_ATTACHMENT: 1600 };

async function toJpeg(uri: string, maxSide: number) {
  let image = await ImageManipulator.manipulate(uri).renderAsync();
  if (Math.max(image.width, image.height) > maxSide) {
    const size = image.width >= image.height ? { width: maxSide } : { height: maxSide };
    image = await ImageManipulator.manipulate(image).resize(size).renderAsync();
  }
  return image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
}

/** Uploads a local image (picker result) to POST /media. */
export async function uploadImage(uri: string, kind: MediaKind): Promise<MediaAsset> {
  const jpeg = await toJpeg(uri, MAX_SIDE[kind]);
  const form = new FormData();
  form.append('kind', kind); // fields must come before the file for the multipart parser
  form.append('file', { uri: jpeg.uri, name: 'image.jpg', type: 'image/jpeg' } as unknown as Blob);
  return api<MediaAsset>('/media', { form, auth: true });
}
