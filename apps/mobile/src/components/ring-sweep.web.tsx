import { useEffect } from 'react';

// Web preview has no Skia: the ring just switches to grey.
export function RingSweep({ onDone }: { size: number; color: string; delay: number; onDone: () => void }) {
  useEffect(() => onDone(), [onDone]);
  return null;
}
