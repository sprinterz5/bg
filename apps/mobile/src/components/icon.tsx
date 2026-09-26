import { Image, type ImageStyle } from 'expo-image';
import type { StyleProp } from 'react-native';

const icons = {
  profileSettings: require('@/assets/icons/profile-settings.svg'),
  compose: require('@/assets/icons/compose.svg'),
  profileEmptyBio: require('@/assets/icons/profile-empty-bio.svg'),
  profileEmptyWrite: require('@/assets/icons/profile-empty-write.svg'),
  searchField: require('@/assets/icons/search-field.svg'),
  // Same glyph, stroke 1.13 so it renders 1.25px at the Explore size (16.6).
  searchFieldThin: require('@/assets/icons/search-field-thin.svg'),
  searchFilter: require('@/assets/icons/search-filter.svg'),
  searchClear: require('@/assets/icons/search-clear.svg'),
  searchBack: require('@/assets/icons/search-back.svg'),
  searchSuggestion: require('@/assets/icons/search-suggestion.svg'),
  chipPlus: require('@/assets/icons/chip-plus.svg'),
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
  headerBell: require('@/assets/icons/header-bell.svg'),
  verified: require('@/assets/icons/verified.png'),
  bookgramAvatar: require('@/assets/icons/bookgram-avatar-bg.svg'),
  storyLike: require('@/assets/icons/story-like.svg'),
  storyLikeFilled: require('@/assets/icons/story-like-filled.svg'),
  storyComment: require('@/assets/icons/story-comment.svg'),
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
  tabHomeInactive: require('@/assets/icons/tab-home-inactive.svg'),
  tabCreateActive: require('@/assets/icons/tab-create-active.svg'),
  tabSearchActive: require('@/assets/icons/tab-search-active.svg'),
  tabProfileActive: require('@/assets/icons/tab-profile-active.svg'),
  profileTabArticles: require('@/assets/icons/profile-tab-articles.svg'),
  profileTabLiked: require('@/assets/icons/profile-tab-liked.svg'),
  tabCreate: require('@/assets/icons/tab-create.svg'),
  tabMessages: require('@/assets/icons/tab-messages.svg'),
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
