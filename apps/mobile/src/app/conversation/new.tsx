import type { Href } from 'expo-router';

import { ConnectionsScreen } from '@/components/connections-screen';
import { openDirect } from '@/lib/chat';
import { replace } from '@/lib/nav';
import { useSession } from '@/state/session';

/** Compose: pick someone you follow → their direct chat. */
export default function NewChat() {
  const { user } = useSession();
  return (
    <ConnectionsScreen
      title="New message"
      withButtons={false}
      source={{ username: user?.username ?? '', kind: 'following' }}
      onOpen={(c) => {
        if (!c.id) return;
        openDirect(c.id)
          .then((conv) => replace(`/conversation/${conv.id}?username=${encodeURIComponent(c.username)}` as Href))
          .catch(() => {});
      }}
    />
  );
}
