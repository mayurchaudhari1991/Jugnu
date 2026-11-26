import type { useRouter } from 'expo-router';
import { create } from 'zustand';

type Router = ReturnType<typeof useRouter>;
import JugnuAlarm from '../../modules/jugnu-alarm';
import { act, findDose } from './engine';

/** The alarm currently on the alarm screen (straight from the native payload). */
export type RingingAlarm = {
  id: string;
  at: number;
  title: string;
  body: string;
  subtitle: string;
  color: string;
  doneLabel: string;
  ring?: number;
  maxRings?: number;
};

type Ringing = {
  alarm: RingingAlarm | null;
  /** True when the alarm opened the app (lock screen or tap), so we step back out after an answer. */
  fromOutside: boolean;
  set(alarm: RingingAlarm | null, fromOutside: boolean): void;
};

export const useRinging = create<Ringing>((set) => ({
  alarm: null,
  fromOutside: false,
  set: (alarm, fromOutside) => set({ alarm, fromOutside }),
}));

/** Records answers given with the notification buttons (often on the lock screen, app closed). */
export function applyAnswers() {
  const answers = JugnuAlarm?.drainAnswers() ?? [];
  for (const a of answers) {
    if (a.id.startsWith('test|')) continue;
    const dose = findDose(a.id);
    if (!dose || dose.status !== 'pending') continue;
    act(dose, a.action === 'done' ? 'done' : a.action === 'skip' ? 'skip' : 'snooze', a.at);
  }
}

/** Reads the alarm that opened or interrupted the app and routes it. */
export function handleLaunch(router: Router) {
  applyAnswers();
  const p = JugnuAlarm?.takePendingLaunch();
  if (!p) return;
  let alarm: RingingAlarm;
  try {
    alarm = JSON.parse(p.alarm);
  } catch {
    return;
  }

  if (p.action === 'open' || p.action === 'ring') {
    useRinging.getState().set(alarm, p.action === 'open');
    router.navigate('/alarm');
    return;
  }

  // A notification button (Done / Snooze / Skip): answer it and get out of the way.
  JugnuAlarm?.dismiss(alarm.id);
  const dose = findDose(alarm.id);
  if (dose) act(dose, p.action === 'done' ? 'done' : p.action === 'skip' ? 'skip' : 'snooze');
  JugnuAlarm?.releaseLockScreen();
  JugnuAlarm?.moveToBack();
}
