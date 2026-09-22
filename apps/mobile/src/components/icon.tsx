import { Image, type ImageStyle } from 'expo-image';
import type { StyleProp } from 'react-native';

const icons = {
  back: require('@/assets/icons/back.svg'),
  google: require('@/assets/icons/google.png'),
  apple: require('@/assets/icons/apple.png'),
  socialCircle: require('@/assets/icons/social-circle.svg'),
  chevronRight: require('@/assets/icons/chevron-right.svg'),
  errorX: require('@/assets/icons/error-x.svg'),
  checkOn: require('@/assets/icons/check-on.svg'),
  checkOff: require('@/assets/icons/check-off.svg'),
  tick: require('@/assets/icons/tick.svg'),
  avatarPlaceholder: require('@/assets/icons/avatar-placeholder.png'),
  plus: require('@/assets/icons/plus-circle.svg'),
  heartHeader: require('@/assets/icons/heart-header.svg'),
  verified: require('@/assets/icons/verified.png'),
  bookgramAvatar: require('@/assets/icons/bookgram-avatar-bg.svg'),
  likeComment: require('@/assets/icons/like-comment.svg'),
  storyNext: require('@/assets/icons/story-next.svg'),
  storyPrev: require('@/assets/icons/story-prev.svg'),
  dot: require('@/assets/icons/dot.svg'),
  postLike: require('@/assets/icons/post-like.svg'),
  postLikeFilled: require('@/assets/icons/post-like-filled.svg'),
  postComment: require('@/assets/icons/post-comment.svg'),
  postShare: require('@/assets/icons/post-share.svg'),
  postBookmark: require('@/assets/icons/post-bookmark.svg'),
  readerClose: require('@/assets/icons/reader-close.svg'),
  readerComment: require('@/assets/icons/reader-comment.svg'),
  readerLike: require('@/assets/icons/reader-like.svg'),
  readerLikeFilled: require('@/assets/icons/reader-like-filled.svg'),
  readerShare: require('@/assets/icons/reader-share.svg'),
  readerBookmark: require('@/assets/icons/reader-bookmark.svg'),
  editorPickerBg: require('@/assets/icons/editor-image-picker-bg.svg'),
  editorPickerIcon: require('@/assets/icons/editor-image-picker-icon.svg'),
  editorPlaceholder: require('@/assets/icons/editor-image-placeholder-icon.svg'),
  pickerClose: require('@/assets/icons/picker-close-x.svg'),
  pickerChevron: require('@/assets/icons/picker-recents-chevron.svg'),
  pickerNextInactive: require('@/assets/icons/picker-next-inactive.svg'),
  pickerNextActive: require('@/assets/icons/picker-next-active.svg'),
  newArticleBack: require('@/assets/icons/newarticle-back.svg'),
  tabHome: require('@/assets/icons/tab-home.svg'),
  tabPlus: require('@/assets/icons/tab-plus.svg'),
  tabChat: require('@/assets/icons/tab-chat.svg'),
  tabSearch: require('@/assets/icons/tab-search.svg'),
  tabProfile: require('@/assets/icons/tab-profile.svg'),
};

export type IconName = keyof typeof icons;

type Props = {
  name: IconName;
  width: number;
  height?: number;
  tintColor?: string;
  style?: StyleProp<ImageStyle>;
};

export function Icon({ name, width, height = width, tintColor, style }: Props) {
  return (
    <Image
      source={icons[name]}
      style={[{ width, height }, style]}
      contentFit="contain"
      tintColor={tintColor}
      transition={0}
    />
  );
}
