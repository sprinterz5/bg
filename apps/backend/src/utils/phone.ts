import { parsePhoneNumberFromString } from "libphonenumber-js";

/** A phone number in international form ("+7 701 123 45 67") as E.164, or null when it isn't a valid number. */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("+")) return null;
  const parsed = parsePhoneNumberFromString(trimmed);
  return parsed?.isValid() ? parsed.number : null;
}

export const E164 = /^\+[1-9]\d{6,14}$/;
