import { addDays, atMinute, parseDateKey } from './time';
import type { Config, DayLog, Dose, Repeat, Routine, Settings } from './types';

/** Does this routine ring on this date? */
export function runsOn(repeat: Repeat, dateKey: string): boolean {
  const d = parseDateKey(dateKey);
  switch (repeat.type) {
    case 'daily':
      return true;
    case 'weekly':
      return repeat.days.includes(d.getDay());
    case 'monthly': {
      // A "31st" reminder rings on the last day of shorter months.
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      return d.getDate() === Math.min(repeat.day, last);
    }
    case 'yearly':
      return d.getMonth() + 1 === repeat.month && d.getDate() === repeat.day;
    case 'once':
      return repeat.date === dateKey;
  }
}

/**
 * The chain rule, for one routine on one day:
 *  - chained slots are planned at start + n × gap;
 *  - each one rings at max(its planned time, previous answer + gap) — so you always get
 *    at least `gap` minutes between two items, and a late answer pushes the rest along;
 *  - a snooze moves that ring to the snooze time (and the rest of the chain with it);
 *  - slots with their own time (fixedMin) ignore the chain.
 */
export function planRoutine(routine: Routine, config: Config, dateKey: string, log: DayLog): Dose[] {
  const slots = routine.slots.filter((s) => config.items[s.itemId]);
  const doses: Dose[] = [];
  let prev: number | null = null;
  let chainIndex = 0;
  const gapMs = Math.max(0, routine.gapMin) * 60000;

  for (const slot of slots) {
    const item = config.items[slot.itemId];
    const key = `${routine.id}:${slot.id}`;
    const entry = log[key] ?? {};
    const status = entry.status ?? 'pending';
    const snoozeUntil = entry.snoozeUntil;
    let planned: number;
    let at: number;
    const fixed = slot.fixedMin != null;

    if (fixed) {
      planned = atMinute(dateKey, slot.fixedMin!);
      at = planned;
    } else {
      planned = atMinute(dateKey, routine.startMin + chainIndex * routine.gapMin);
      chainIndex++;
      at = planned;
      if (prev != null) at = Math.max(at, prev + gapMs);
    }
    if (snoozeUntil && status === 'pending') at = Math.max(at, snoozeUntil);

    if (!fixed) {
      const answered = status === 'done' || status === 'skipped';
      prev = answered && entry.at ? entry.at : at;
    }

    doses.push({
      key,
      alarmId: `${dateKey}|${key}`,
      date: dateKey,
      routine,
      item,
      slot,
      index: 0,
      of: 0,
      planned,
      at,
      status,
      actedAt: entry.at,
      snoozes: entry.snoozes ?? 0,
      snoozed: !!snoozeUntil && status === 'pending',
      fixed,
    });
  }

  doses.sort((a, b) => a.planned - b.planned);
  doses.forEach((d, i) => {
    d.index = i;
    d.of = doses.length;
  });
  return doses;
}

export type RoutineDay = { routine: Routine; doses: Dose[] };

/** Every active routine that rings on this date, with its doses. Ordered by start time. */
export function planDay(config: Config, dateKey: string, log: DayLog): RoutineDay[] {
  return config.routines
    .filter((r) => r.active && r.slots.length > 0 && runsOn(r.repeat, dateKey))
    .map((routine) => ({ routine, doses: planRoutine(routine, config, dateKey, log) }))
    .filter((r) => r.doses.length > 0)
    .sort((a, b) => a.doses[0].planned - b.doses[0].planned);
}

/** How long after `at` a dose can still be answered before it counts as missed. */
export function answerWindowMs(settings: Settings): number {
  return ((settings.maxRings - 1) * settings.snoozeMin * 60 + settings.ringSec) * 1000 + 60000;
}

export function isOverdueMissed(dose: Dose, settings: Settings, now: number): boolean {
  return dose.status === 'pending' && dose.at >= settings.trackFrom && now > dose.at + answerWindowMs(settings);
}

/** Planned before Jugnu was set up — shown, but never rung or counted. */
export function isBeforeStart(dose: Dose, settings: Settings): boolean {
  return dose.status === 'pending' && dose.at < settings.trackFrom;
}

/** Still worth showing as "up next": unanswered and not past its answer window. */
export function isAnswerable(dose: Dose, settings: Settings, now: number): boolean {
  return dose.status === 'pending' && !isBeforeStart(dose, settings) && now <= dose.at + answerWindowMs(settings);
}

/** Alarms to hand to Android: every unanswered dose in the next `days` days that is still in the future. */
export function upcomingDoses(
  config: Config,
  logs: Record<string, DayLog>,
  today: string,
  now: number,
  days = 7,
  limit = 300,
): Dose[] {
  const out: Dose[] = [];
  for (let i = 0; i < days && out.length < limit; i++) {
    const date = addDays(today, i);
    for (const rd of planDay(config, date, logs[date] ?? {})) {
      for (const d of rd.doses) {
        if (d.status === 'pending' && d.at > now + 1000) out.push(d);
      }
    }
  }
  out.sort((a, b) => a.at - b.at);
  return out.slice(0, limit);
}
