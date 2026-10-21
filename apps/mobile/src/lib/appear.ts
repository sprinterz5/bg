import { FadeInDown, FadeInRight } from 'react-native-reanimated';

// Not designed: rows of a list that just loaded rise in one after another (the first dozen; the rest appear as they
// are, so scrolling never waits for an animation).
export const appear = (index: number) => (index < 12 ? FadeInDown.delay(index * 35).duration(260) : undefined);

/** The same for cards in a sideways row. */
export const appearSideways = (index: number) => (index < 6 ? FadeInRight.delay(index * 50).duration(280) : undefined);
