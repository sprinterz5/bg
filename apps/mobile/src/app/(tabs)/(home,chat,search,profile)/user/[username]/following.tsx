import { useLocalSearchParams } from 'expo-router';

import { ConnectionsScreen } from '@/components/connections-screen';

export default function Following() {
  const { username } = useLocalSearchParams<{ username: string }>();
  return <ConnectionsScreen title="Following" withButtons={false} source={{ username: username ?? '', kind: 'following' }} />;
}
