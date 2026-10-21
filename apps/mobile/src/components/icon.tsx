import { Image, type ImageStyle } from 'expo-image';
import type { StyleProp } from 'react-native';

const icons = {
  profileSettings: require('@/assets/icons/profile-settings.svg'),
  profileBack: require('@/assets/icons/profile-back.svg'),
  notifBack: require('@/assets/icons/notif-back.svg'),
  compose: require('@/assets/icons/compose.svg'),
  chatSearch: require('@/assets/icons/chat-search.svg'),
  chatSearchEmpty: require('@/assets/icons/chat-search-empty.svg'),
  followingCompose: require('@/assets/icons/following-compose.svg'),
  shareCheck: require('@/assets/icons/share-check.svg'),
  chatCall: require('@/assets/icons/chat-call.svg'),
  chatVideo: require('@/assets/icons/chat-video.svg'),
  chatGallery: require('@/assets/icons/chat-gallery.svg'),
  chatSend: require('@/assets/icons/chat-send.svg'),
  chatPlus: require('@/assets/icons/chat-plus.svg'),
  profileEmptyBio: require('@/assets/icons/profile-empty-bio.svg'),
  profileEmptyWrite: require('@/assets/icons/profile-empty-write.svg'),
  searchField: require('@/assets/icons/search-field.svg'),
  // Same glyph, stroke 1.13 so it renders 1.25px at the Explore size (16.6).
  searchFieldThin: require('@/assets/icons/search-field-thin.svg'),
  exploreSearch: require('@/assets/icons/explore-search.svg'),
  cardMore: require('@/assets/icons/card-more.svg'),
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
  // Home + story viewer (Frame 1049)
  homePlus: require('@/assets/icons/home-plus.svg'),
  feedLike: require('@/assets/icons/feed-like.svg'),
  feedLikeFilled: require('@/assets/icons/feed-like-filled.svg'),
  feedComment: require('@/assets/icons/feed-comment.svg'),
  feedViews: require('@/assets/icons/feed-views.svg'),
  feedBookmark: require('@/assets/icons/feed-bookmark.svg'),
  feedBookmarkFilled: require('@/assets/icons/feed-bookmark-filled.svg'),
  feedShare: require('@/assets/icons/feed-share.svg'),
  homeBell: require('@/assets/icons/home-bell.svg'),
  profilePlus: require('@/assets/icons/profile-plus.svg'),
  postViews: require('@/assets/icons/post-views.svg'),
  postSend: require('@/assets/icons/post-send.svg'),
  postBookmark2: require('@/assets/icons/post-bookmark-2.svg'),
  postMenu: require('@/assets/icons/post-menu.svg'),
  storyRing: require('@/assets/icons/story-ring.svg'),
  // Frame 1198 Explore list rows and the always-visible search field.
  exploreFieldSearch: require('@/assets/icons/explore-field-search.svg'),
  rowLike: require('@/assets/icons/row-like.svg'),
  rowShare: require('@/assets/icons/row-share.svg'),
  rowBookmark: require('@/assets/icons/row-bookmark.svg'),
  rowBookmarkFilled: require('@/assets/icons/row-bookmark-filled.svg'),
  rowMore: require('@/assets/icons/row-more.svg'),
  // Frame 1198 "Choose a cover".
  coverClose: require('@/assets/icons/cover-close.svg'),
  coverChevron: require('@/assets/icons/cover-chevron.svg'),
  coverCheck: require('@/assets/icons/cover-check.svg'),
  coverNext: require('@/assets/icons/cover-next.svg'),
  storyNext: require('@/assets/icons/story-next.svg'),
  captionDone: require('@/assets/icons/caption-done.svg'),
  coverTileFade: require('@/assets/icons/cover-tile-fade.svg'),
  storyRingSeen: require('@/assets/icons/story-ring-seen.svg'),
  storyBack: require('@/assets/icons/story-back.svg'),
  storyClose: require('@/assets/icons/story-close.svg'),
  storyHeart: require('@/assets/icons/story-heart.svg'),
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
  readerClose2: require('@/assets/icons/reader-close-2.svg'),
  readerComment: require('@/assets/icons/reader-comment.svg'),
  readerLike: require('@/assets/icons/reader-like.svg'),
  readerLikeFilled: require('@/assets/icons/reader-like-filled.svg'),
  readerShare: require('@/assets/icons/reader-share.svg'),
  readerBookmark: require('@/assets/icons/reader-bookmark.svg'),
  editorPickerBg: require('@/assets/icons/editor-image-picker-bg.svg'),
  editorPickerIcon: require('@/assets/icons/editor-image-picker-icon.svg'),
  editorPickerPlus: require('@/assets/icons/editor-picker-plus.svg'),
  editorPlaceholder: require('@/assets/icons/editor-image-placeholder-icon.svg'),
  editorUndo: require('@/assets/icons/editor-undo.svg'),
  editorRedo: require('@/assets/icons/editor-redo.svg'),
  editorGallery: require('@/assets/icons/editor-gallery.svg'),
  editorNext: require('@/assets/icons/editor-next.svg'),
  pickerClose: require('@/assets/icons/picker-close-x.svg'),
  pickerChevron: require('@/assets/icons/picker-recents-chevron.svg'),
  pickerNextInactive: require('@/assets/icons/picker-next-inactive.svg'),
  pickerNextActive: require('@/assets/icons/picker-next-active.svg'),
  newArticleBack: require('@/assets/icons/newarticle-back.svg'),
  articleBack: require('@/assets/icons/article-back.svg'),
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
