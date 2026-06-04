export const publicUserSelect = {
  id: true,
  username: true,
  displayName: true,
  bio: true,
  avatarUrl: true,
  interests: true,
  role: true,
  createdAt: true
} as const;

export const privateUserSelect = {
  ...publicUserSelect,
  email: true,
  appleUserId: true,
  lastSeenAt: true
} as const;
