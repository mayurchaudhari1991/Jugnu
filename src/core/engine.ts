import JugnuAlarm, { type NativeAlarm } from '../../modules/jugnu-alarm';
import { isOverdueMissed, planDay, upcomingDoses } from './schedule';
import { getConfig, useStore } from './store';
import { addDays, todayKey } from './time';
import type { Dose } from './types';

export const hasNative = !!JugnuAlarm;

function toNative(d: Dose): NativeAlarm {
  const s = getConfig().settings;
  const label = d.item.number ? `#${d.item.number} · ` : '';
  return {
    id: d.alarmId,
    at: d.at,
    title: d.item.title,
    body: `${label}${d.item.detail}${d.item.note ? `\n${d.item.note}` : ''}`,
    subtitle: d.of > 1 ? `${d.routine.name} · ${d.index + 1} of ${d.of}` : d.routine.name,
    color: d.item.color,
    doneLabel: d.item.doneLabel || 'Done',
    snoozeMin: s.snoozeMin,
    maxRings: s.maxRings,
    reRingMin: s.snoozeMin,
    timeoutSec: s.ringSec,
    sound: (d.routine.sound ?? s.sound).uri,
    soundTitle: (d.routine.sound ?? s.sound).title,
    vibrate: s.vibrate ?? 'pulse',
  };
}

/** Marks every unanswered dose whose answer window has passed (today and yesterday) as missed. */
export function markMissed(now = Date.now()) {
  const cfg = getConfig();
  const st = useStore.getState();
  const today = todayKey(now);
  for (const date of [addDays(today, -1), today]) {
    for (const rd of planDay(cfg, date, st.logs[date] ?? {})) {
      for (const d of rd.doses) {
        if (isOverdueMissed(d, cfg.settings, now)) {
          st.setLog(date, d.key, { status: 'missed', at: d.at, snoozes: d.snoozes });
        }
      }
    }
  }
}

/** Hands Android every upcoming alarm for the next 7 days. Safe to call often. */
export function syncAlarms(now = Date.now()): number {
  markMissed(now);
  if (!JugnuAlarm) return 0;
  const st = useStore.getState();
  const doses = upcomingDoses(getConfig(), st.logs, todayKey(now), now, 7, 300);
  try {
    return JugnuAlarm.setAlarms(JSON.stringify(doses.map(toNative)));
  } catch (e) {
    console.warn('setAlarms failed', e);
    return 0;
  }
}

export type Action = 'done' | 'skip' | 'snooze' | 'undo';

/** Answer a dose. `snoozeMin` overrides the default snooze length for this one snooze. */
export function act(d: Dose, action: Action, now = Date.now(), snoozeMin?: number) {
  const st = useStore.getState();
  const s = st.settings;
  switch (action) {
    case 'done':
      st.setLog(d.date, d.key, { status: 'done', at: now, snoozes: d.snoozes });
      break;
    case 'skip':
      st.setLog(d.date, d.key, { status: 'skipped', at: now, snoozes: d.snoozes });
      break;
    case 'snooze':
      st.setLog(d.date, d.key, { snoozeUntil: Math.max(now, d.at) + (snoozeMin ?? s.snoozeMin) * 60000, snoozes: d.snoozes + 1 });
      break;
    case 'undo':
      st.setLog(d.date, d.key, null);
      break;
  }
  JugnuAlarm?.dismiss(d.alarmId);
  syncAlarms(now);
}

/** Finds the dose behind a native alarm id (`${date}|${routineId}:${slotId}`). */
export function findDose(alarmId: string): Dose | null {
  const [date, key] = alarmId.split('|');
  if (!date || !key) return null;
  const st = useStore.getState();
  for (const rd of planDay(getConfig(), date, st.logs[date] ?? {})) {
    const d = rd.doses.find((x) => x.key === key);
    if (d) return d;
  }
  return null;
}

/** The dose that follows `d` in its routine, if any. */
export function nextInRoutine(d: Dose): Dose | null {
  const st = useStore.getState();
  for (const rd of planDay(getConfig(), d.date, st.logs[d.date] ?? {})) {
    if (rd.routine.id !== d.routine.id) continue;
    return rd.doses.find((x) => x.index > d.index && x.status === 'pending') ?? null;
  }
  return null;
}

/** A one-off ring 10 seconds from now, to check sound and the lock screen. */
export function testAlarm(seconds = 10) {
  if (!JugnuAlarm) return false;
  const s = getConfig().settings;
  const alarm: NativeAlarm = {
    id: `test|${Date.now()}`,
    at: Date.now() + seconds * 1000,
    title: 'Test alarm',
    body: 'This is how Jugnu rings. Tap Done to stop it.',
    subtitle: 'Jugnu',
    color: '#FFB627',
    doneLabel: 'Done',
    snoozeMin: s.snoozeMin,
    maxRings: 1,
    reRingMin: s.snoozeMin,
    timeoutSec: 60,
    sound: s.sound.uri,
    soundTitle: s.sound.title,
    vibrate: s.vibrate ?? 'pulse',
  };
  JugnuAlarm.scheduleOne(JSON.stringify(alarm), alarm.at);
  return true;
}
