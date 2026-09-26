import { useLocalSearchParams } from 'expo-router';

import { ConnectionsScreen } from '@/components/connections-screen';

export default function Followers() {
  const { username } = useLocalSearchParams<{ username: string }>();
  return <ConnectionsScreen title="Followers" withButtons source={{ username: username ?? '', kind: 'followers' }} />;
}
