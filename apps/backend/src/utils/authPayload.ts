import type { User, UserRole } from "@prisma/client";

export interface TokenUser {
  id: string;
  username: string;
  role: UserRole;
}

export function toTokenPayload(user: Pick<User, "id" | "username" | "role">) {
  return {
    sub: user.id,
    username: user.username,
    role: user.role
  };
}
