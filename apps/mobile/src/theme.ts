import { Platform } from 'react-native';

export const colors = {
  bg: '#FFFFFF',
  // TH export: text is #0F1419 everywhere (icons stay black)
  text: '#0F1419',
  textMuted: '#8C8C8C',
  textSubtle: '#999999',
  textGray: '#6F6F71',
  // The new layouts have no blue: buttons, cursor, indicators and saved bookmarks are black.
  primary: '#000000',
  primaryPressed: '#2A2A2A',
  disabled: '#DDDDDD',
  surface: '#F2F2F2',
  surfaceSoft: '#F7F7F7',
  hairline: '#EFF3F4',
  danger: '#FF5A79',
  like: '#F91880',
} as const;

export const fonts = {
  logo: 'Caveat_400Regular',
  // Home header: the frame's logo has a thin stroke, one weight up stands in for it.
  logoMedium: 'Caveat_500Medium',
  // Splash and sign-in: the heavier logo of the new layout.
  logoSemi: 'Caveat_600SemiBold',
  display: 'Sen_800ExtraBold',
  // Home card titles: the design's Sentinel Bold is licence-only (annual app licence), Source Serif 4 Bold is the free match.
  headline: 'SourceSerif4_700Bold',
  serif: Platform.select({ ios: 'Georgia', default: 'serif' }),
  reading: Platform.select({ ios: 'Iowan Old Style', default: 'serif' }),
} as const;

export const layout = {
  gutter: 18,
  buttonHeight: 56,
} as const;

export const motion = {
  fast: 180,
  base: 280,
  slow: 450,
} as const;
