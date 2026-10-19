import { useEffect, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { LayoutAnimationConfig } from 'react-native-reanimated';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

/**
 * Dev-only design check on web (`notes/tools/uicheck`): `?capture` in the URL renders the screen like an
 * iPhone 390×844 (47 status bar, 34 home indicator) with a mock signed-in user, so it can be screenshotted
 * and compared with the design frames.
 */
export const CAPTURE =
  __DEV__ && Platform.OS === 'web' && typeof location !== 'undefined' && new URLSearchParams(location.search).has('capture');

/** `?capture&draft={"name":"Steve Jobsie"}` prefills the signup draft (typed-in states of the frames). */
export function captureParam(name: string): string | null {
  return CAPTURE ? new URLSearchParams(location.search).get(name) : null;
}

const CAPTURE_INSETS = { top: 47, bottom: 34, left: 0, right: 0 };

export function CaptureInsets({ children }: { children: ReactNode }) {
  if (!CAPTURE) return children;
  return (
    <SafeAreaInsetsContext.Provider value={CAPTURE_INSETS}>
      <UndoAutofocusScroll />
      {/* Reanimated's web entering animations leave elements absolutely positioned in headless Chrome */}
      <LayoutAnimationConfig skipEntering>{children}</LayoutAnimationConfig>
    </SafeAreaInsetsContext.Provider>
  );
}

/** Web-only quirks the phone doesn't have: an autofocused input scrolls the page; inputs have a min width. */
function UndoAutofocusScroll() {
  useEffect(() => {
    const settle = () => {
      document.querySelectorAll<HTMLElement>('*').forEach((el) => {
        if (el.scrollTop) el.scrollTop = 0;
        if (el.scrollLeft) el.scrollLeft = 0;
        // RN-web gives multiline inputs rows=2; on the phone an empty one is one line tall
        if (el instanceof HTMLTextAreaElement && el.rows !== 1) el.rows = 1;
      });
    };
    // web inputs have an intrinsic min width (20 chars) that overflows flex rows
    const css = document.createElement('style');
    css.textContent = 'input, textarea { min-width: 0 !important; outline: none !important; border: 0 !important }';
    document.head.appendChild(css);
    const timers = [600, 1200, 2000, 3000].map((ms) => setTimeout(settle, ms));
    return () => timers.forEach(clearTimeout);
  }, []);
  return null;
}
