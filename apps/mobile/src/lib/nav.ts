import { router, type Href } from 'expo-router';
import { BackHandler, Platform, type NativeEventSubscription } from 'react-native';

// While a push transition is running, a second push (double tap) or a pop (Android back, close buttons)
// leaves the native stack in a broken state: the screen underneath stays blank until the JS is reloaded.
// So for LOCK_MS after a push, repeated pushes are ignored and back presses are swallowed.
const LOCK_MS = 700;
let lockedUntil = 0;
let backBlock: NativeEventSubscription | null = null;

const locked = () => Date.now() < lockedUntil;

export function push(href: Href) {
  if (locked()) return;
  lockedUntil = Date.now() + LOCK_MS;
  router.push(href);

  if (Platform.OS === 'android') {
    backBlock?.remove();
    backBlock = BackHandler.addEventListener('hardwareBackPress', locked);
    setTimeout(() => {
      backBlock?.remove();
      backBlock = null;
    }, LOCK_MS);
  }
}

export function back() {
  if (locked()) return;
  router.back();
}
