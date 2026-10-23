import type { RefObject } from 'react';
import type { View } from 'react-native';

// Web: no Skia (CanvasKit isn't loaded), so stories switch without the page turn.
export const CURL_SUPPORTED = false;
export type Snapshot = never;

export async function snapshotView(_ref: RefObject<View | null>): Promise<Snapshot | null> {
  return null;
}

export function disposeSnapshot(_image: Snapshot) {}

export function PageCurlCanvas(_props: Record<string, unknown>) {
  return null;
}
