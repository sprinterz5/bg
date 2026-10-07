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
