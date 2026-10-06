import { Image } from 'expo-image';
import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/tab-bar';
import { EXPLORE_FEED } from '@/mock/data';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

export default function TabsLayout() {
  const { user, ready } = useSession();
  // Explore's first remote photos start downloading while the user is still on Home, so the tab opens filled.
  useEffect(() => {
    if (!user) return;
    const urls = EXPLORE_FEED.slice(0, 8)
      .map((p) => (typeof p.image === 'object' && p.image && 'uri' in p.image ? p.image.uri : null))
      .filter((u): u is string => !!u);
    if (urls.length) Image.prefetch(urls, 'disk').catch(() => {});
  }, [user]);
  if (!ready) return null; // checking the stored session
  if (!user) return <Redirect href="/welcome" />;

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        sceneStyle: { backgroundColor: colors.bg },
      }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="create" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
