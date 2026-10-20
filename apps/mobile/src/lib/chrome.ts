import { makeMutable } from 'react-native-reanimated';

/**
 * How far Home's chrome is tucked away, X-style: 0 = top bar and tab bar shown, 1 = both hidden. Home drives it from
 * its scroll (down hides, up brings back); the tab bar follows it while Home is the open tab.
 */
export const homeChromeHidden = makeMutable(0);
