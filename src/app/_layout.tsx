import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import JugnuAlarm from '../../modules/jugnu-alarm';
import { syncAlarms } from '@/core/engine';
import { handleLaunch } from '@/core/launch';
import { startAccount } from '@/core/cloud';
import { useStore } from '@/core/store';
import { C } from '@/ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });
  const hydrated = useStore((s) => s.hydrated);
  const setupDone = useStore((s) => s.settings.setupDone);
  const rev = useStore((s) => s.rev);
  const router = useRouter();
  const ready = fontsLoaded && hydrated;
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    useStore.getState().hydrate();
    startAccount();
  }, []);

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch(() => {});
    syncAlarms();
    // The router mounts on the next frame; give it a moment before routing an alarm launch.
    const first = setTimeout(() => handleLaunch(router), 50);
    const sub = JugnuAlarm?.addListener('onAlarmIntent', () => handleLaunch(router));
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        handleLaunch(router);
        syncAlarms();
      }
    });
    return () => {
      clearTimeout(first);
      sub?.remove();
      app.remove();
    };
  }, [ready, router]);

  // First launch goes through the welcome + permissions screen.
  useEffect(() => {
    if (!ready || setupDone) return;
    const t = setTimeout(() => router.replace('/setup'), 0);
    return () => clearTimeout(t);
  }, [ready, setupDone, router]);

  // Any edit re-books the alarms (debounced so typing doesn't thrash AlarmManager).
  useEffect(() => {
    if (!ready) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => syncAlarms(), 800);
  }, [rev, ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="alarm" options={{ animation: 'fade', gestureEnabled: false, contentStyle: { backgroundColor: C.night } }} />
        <Stack.Screen name="setup" options={{ animation: 'fade', contentStyle: { backgroundColor: C.night } }} />
        <Stack.Screen name="routine/[id]" />
        <Stack.Screen name="item/[id]" />
        <Stack.Screen name="scan" />
        <Stack.Screen name="quick" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="auth-callback" options={{ animation: "none" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
