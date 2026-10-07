// Where each story's photo sits on Home (window coordinates), so the viewer can grow out of it and shrink back
// into it. Filled by the Home stories row when one is opened.
export type StoryOrigin = { x: number; y: number; size: number };

const origins = new Map<string, StoryOrigin>();

export function setStoryOrigin(id: string, origin: StoryOrigin) {
  origins.set(id, origin);
}

export function storyOrigin(id: string): StoryOrigin | null {
  return origins.get(id) ?? null;
}

// The viewer tells the stories row it is closing (with the stories watched in it), so their rings can turn grey
// while it shrinks back instead of waiting for Home to be focused again.
type ClosingListener = (watched: string[]) => void;
let closingListener: ClosingListener | null = null;

export function onStoriesClosing(listener: ClosingListener) {
  closingListener = listener;
  return () => {
    if (closingListener === listener) closingListener = null;
  };
}

export function storiesClosing(watched: string[]) {
  closingListener?.(watched);
}
