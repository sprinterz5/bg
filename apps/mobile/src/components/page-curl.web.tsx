import type { RefObject } from 'react';
import type { View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

// Web preview has no Skia (CanvasKit isn't loaded): stories switch without the page turn.

export const CURL_SUPPORTED = false;
export type Snapshot = { dispose(): void };

export async function snapshotView(_ref: RefObject<View | null>): Promise<Snapshot | null> {
  return null;
}

export function disposeSnapshot(_image: Snapshot) {}

type Props = {
  layers: { id: string; image: Snapshot }[];
  active: SharedValue<string>;
  under: SharedValue<string>;
  progress: SharedValue<number>;
  angle: SharedValue<number>;
  width: number;
  height: number;
};

export function PageCurlCanvas(_props: Props) {
  return null;
}
