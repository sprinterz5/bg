import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { api } from './api';

// Errors on the phone go to the backend log (POST /client-logs), so device-only bugs can be read on the VPS.
// Same message at most once a minute, at most 20 per app run; a failed report is dropped silently.
const sent = new Map<string, number>();
let budget = 20;

export function reportError(error: unknown, opts: { fatal?: boolean; level?: 'error' | 'warn' } = {}) {
  const message = (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).slice(0, 2000);
  const now = Date.now();
  if (budget <= 0 || now - (sent.get(message) ?? 0) < 60_000) return;
  sent.set(message, now);
  budget -= 1;
  api('/client-logs', {
    auth: true,
    body: {
      level: opts.level ?? 'error',
      message,
      stack: error instanceof Error ? error.stack?.slice(0, 8000) : undefined,
      fatal: opts.fatal,
      platform: Platform.OS,
      appVersion: Constants.expoConfig?.version,
    },
  }).catch(() => {});
}

let installed = false;

/** Global JS errors (fatal or not) and console.error calls. */
export function installErrorReporting() {
  if (installed) return;
  installed = true;
  const previous = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    reportError(error, { fatal: isFatal });
    previous(error, isFatal);
  });
  const consoleError = console.error;
  console.error = (...args: unknown[]) => {
    reportError(args.find((a) => a instanceof Error) ?? args.map(String).join(' '));
    consoleError(...args);
  };
}
