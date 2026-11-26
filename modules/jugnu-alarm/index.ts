import { requireOptionalNativeModule } from 'expo';

/** One alarm as the native side expects it. `at` is epoch milliseconds. */
export type NativeAlarm = {
  id: string;
  at: number;
  title: string;
  body: string;
  subtitle: string;
  color: string;
  doneLabel: string;
  snoozeMin: number;
  maxRings: number;
  reRingMin: number;
  timeoutSec: number;
  /** Content URI of the sound; '' = the phone's default alarm. */
  sound: string;
  soundTitle: string;
  /** Vibration pattern while ringing: pulse | heartbeat | long | gentle | off. */
  vibrate: string;
};

export type PickedSound = { uri: string; title: string };

export type NativePermissions = {
  notifications: boolean;
  exact: boolean;
  fullScreen: boolean;
  battery: boolean;
  /** "Display over other apps": lets the alarm page open by itself on OnePlus, Xiaomi, Oppo… */
  overlay: boolean;
  /** The alarm channel still pops up (some phones lower it). */
  popup: boolean;
  /** Android 14+ "Turn screen on" special access (true where the phone has no such switch). */
  screenOn: boolean;
};

/** Whether recent alarms made it over the lock screen by themselves (epoch ms, 0 = never). */
export type LockHealth = { lastOk: number; lastMiss: number; missStreak: number };

/** 'open' = launched by the alarm (lock screen or tap); 'ring' = rang while the app was already open. */
export type PendingLaunch = { alarm: string; action: 'open' | 'ring' | 'done' | 'snooze' | 'skip' };

type JugnuAlarmNative = {
  setAlarms(json: string): number;
  dismiss(id: string): void;
  silence(id: string): void;
  scheduleOne(json: string, atMs: number): void;
  takePendingLaunch(): PendingLaunch | null;
  drainAnswers(): { id: string; action: 'done' | 'snooze' | 'skip'; at: number }[];
  releaseLockScreen(): void;
  moveToBack(): void;
  getPermissions(): NativePermissions;
  openNotificationSettings(): void;
  openSoundSettings(): void;
  openFullScreenSettings(): void;
  openExactAlarmSettings(): void;
  requestIgnoreBattery(): void;
  openOverlaySettings(): void;
  openAppInfo(): void;
  openScreenOnSettings(): void;
  getLockHealth(): LockHealth;
  appVersionCode(): number;
  clearLockHealth(): void;
  pickSystemSound(current: string): Promise<PickedSound | null>;
  pickFileSound(): Promise<PickedSound | null>;
  previewSound(uri: string): void;
  stopPreview(): void;
  defaultSoundTitle(): string;
  addListener(event: 'onAlarmIntent', cb: () => void): { remove(): void };
};

/** Null where the native module isn't built in (Expo Go, web). */
export default requireOptionalNativeModule<JugnuAlarmNative>('JugnuAlarm');
