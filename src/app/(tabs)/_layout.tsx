import { Tabs } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type UIIconName } from '@/ui/icons';
import { C, MAX_W } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

const TABS: { name: string; label: string; icon: UIIconName }[] = [
  { name: 'index', label: 'Today', icon: 'today' },
  { name: 'routines', label: 'Routines', icon: 'routines' },
  { name: 'history', label: 'History', icon: 'history' },
  { name: 'settings', label: 'Settings', icon: 'settings' },
];

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.bg } }} tabBar={(p) => <TabBar {...p} />}>
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
      ))}
    </Tabs>
  );
}

function TabBar({ state, navigateToTab }: { state: { index: number; routes: { key: string; name: string }[] }; navigateToTab: (routeKey: string) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line, paddingBottom: Math.max(insets.bottom, 10), paddingTop: 8 }}>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 8 }}>
        {state.routes.map((route, i) => {
          const tab = TABS.find((t) => t.name === route.name);
          if (!tab) return null;
          const on = state.index === i;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={tab.label}
              onPress={() => navigateToTab(route.key)}
              style={{ flex: 1, alignItems: 'center', gap: 4, minHeight: 52, justifyContent: 'center' }}
            >
              <View style={{ width: 56, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.ink : 'transparent' }}>
                <Icon name={tab.icon} size={21} color={on ? '#FFFFFF' : C.ink2} />
              </View>
              <Txt size={11.5} weight={on ? 'heavy' : 'semibold'} color={on ? C.ink : C.ink2} numberOfLines={1}>
                {tab.label}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
