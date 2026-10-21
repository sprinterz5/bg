import { getLocales } from 'expo-localization';
import { AsYouType, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

/** The phone's region (KZ, US…): numbers typed or saved without "+" are read as local to it. */
export function deviceRegion(): CountryCode | undefined {
  return (getLocales()[0]?.regionCode ?? undefined) as CountryCode | undefined;
}

/** E.164 ("+77011234567") or null when it isn't a valid number. */
export function toE164(input: string, region = deviceRegion()): string | null {
  const parsed = parsePhoneNumberFromString(input.trim(), region);
  return parsed?.isValid() ? parsed.number : null;
}

/** Spaces the number while it's typed ("+7 701 123 45 67"). */
export function formatTyping(input: string, region = deviceRegion()) {
  return new AsYouType(region).input(input);
}

/** The sign-in field takes a username or a phone number: digits, spaces, "+", "(", ")" and "-" only. */
export const looksLikePhone = (v: string) => /^\+?[\d\s()-]{6,}$/.test(v.trim());
