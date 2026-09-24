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
  emailVerified: true,
  appleUserId: true,
  googleUserId: true,
  lastSeenAt: true
} as const;
