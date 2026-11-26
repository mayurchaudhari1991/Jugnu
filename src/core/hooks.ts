import { useEffect, useMemo, useState } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import JugnuAlarm, { type NativePermissions } from '../../modules/jugnu-alarm';
import { planDay } from './schedule';
import { useStore } from './store';
import { todayKey } from './time';

/** Current time, refreshed every 20 s and whenever the app comes back to the front. */
export function useNow(intervalMs = 20000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setNow(Date.now()));
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, [intervalMs]);
  return now;
}

/** Today's plan, recomputed when data changes or the minute ticks over. */
export function useToday(now: number) {
  const rev = useStore((s) => s.rev);
  const date = todayKey(now);
  const minute = Math.floor(now / 60000);
  return useMemo(() => {
    const st = useStore.getState();
    return { date, days: planDay({ items: st.items, routines: st.routines, settings: st.settings }, date, st.logs[date] ?? {}) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev, date, minute]);
}

const NO_NATIVE: NativePermissions = { notifications: true, exact: true, fullScreen: true, battery: true, overlay: true, popup: true, screenOn: true };

export function usePermissions() {
  const [perms, setPerms] = useState<NativePermissions>(() => JugnuAlarm?.getPermissions() ?? NO_NATIVE);
  useEffect(() => {
    const refresh = () => setPerms(JugnuAlarm?.getPermissions() ?? NO_NATIVE);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    const t = setInterval(refresh, 3000);
    return () => {
      sub.remove();
      clearInterval(t);
    };
  }, []);
  const refresh = () => setPerms(JugnuAlarm?.getPermissions() ?? NO_NATIVE);
  // Over the lock screen the alarm page needs the full-screen notification, which only works when
  // the alarm channel pops up (OnePlus/Oppo/Xiaomi switch that off for new apps).
  const allOk = perms.notifications && perms.exact && perms.fullScreen && perms.popup && perms.screenOn;
  return { perms, refresh, allOk };
}

const MAKER = String((Platform.constants as { Manufacturer?: string } | undefined)?.Manufacturer ?? '').toLowerCase();

/**
 * Phone makers that add their own background limits on top of Android's. Their switch can't be
 * read or changed by apps, so we explain where it is.
 */
export function makerTip(): { title: string; help: string } | null {
  if (/oneplus|oppo|realme/.test(MAKER)) {
    return {
      title: 'Allow background activity',
      help: 'App info → Battery usage → "Allow background activity". Without it your phone stops the alarm page from opening over the lock screen.',
    };
  }
  if (/xiaomi|redmi|poco/.test(MAKER)) {
    return {
      title: 'Autostart and lock-screen pop-ups',
      help: 'App info → turn on Autostart, then Other permissions → "Show on Lock screen" and "Display pop-up windows while running in the background".',
    };
  }
  if (/vivo|iqoo/.test(MAKER)) {
    return {
      title: 'Background pop-ups',
      help: 'App info → Permissions → allow "Display pop-up windows" / background pop-ups, and Battery → allow high background power use.',
    };
  }
  return null;
}

export async function requestNotifications(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (Number(Platform.Version) < 33) return true;
  const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  if (r === PermissionsAndroid.RESULTS.GRANTED) return true;
  JugnuAlarm?.openNotificationSettings();
  return false;
}
