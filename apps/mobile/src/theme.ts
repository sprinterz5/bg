import { Platform } from 'react-native';

export const colors = {
  bg: '#FAFAFA',
  text: '#0F1419',
  textMuted: '#8C8C8C',
  textSubtle: '#788690',
  textGray: '#6F6F71',
  primary: '#455DFF',
  primaryPressed: '#3A50E6',
  disabled: '#DDDDDD',
  surface: '#F2F2F2',
  surfaceSoft: '#F7F7F7',
  hairline: '#EFF3F4',
  danger: '#FF5A79',
  like: '#F91880',
} as const;

export const fonts = {
  logo: 'Caveat_400Regular',
  display: 'Sen_800ExtraBold',
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
