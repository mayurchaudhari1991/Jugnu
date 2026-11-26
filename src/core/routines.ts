import { planRoutine } from './schedule';
import { getConfig, useStore } from './store';
import { fmtMinFull, MONTHS, parseDateKey, todayKey, uid, WEEKDAYS_SHORT } from './time';
import type { Item, Repeat, Routine } from './types';

export function repeatText(r: Repeat): string {
  switch (r.type) {
    case 'daily':
      return 'Every day';
    case 'weekly': {
      const d = [...r.days].sort();
      if (d.length === 7) return 'Every day';
      if (d.join() === '1,2,3,4,5') return 'Weekdays';
      if (d.join() === '0,6') return 'Weekends';
      return d.map((x) => WEEKDAYS_SHORT[x]).join(', ') || 'No days';
    }
    case 'monthly':
      return `Every month on the ${ordinal(r.day)}`;
    case 'yearly':
      return `Every year on ${r.day} ${MONTHS[r.month - 1]}`;
    case 'once': {
      const d = parseDateKey(r.date);
      return `Once, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    }
  }
}

export function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** Planned times for a routine on a normal day (no answers yet), keyed by slot id. */
export function plannedTimes(r: Routine): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of planRoutine(r, getConfig(), todayKey(), {})) out[d.slot.id] = d.planned;
  return out;
}

export function routineSummary(r: Routine): string {
  if (r.slots.length === 0) return 'No items yet';
  const times = Object.values(plannedTimes(r)).sort((a, b) => a - b);
  const first = new Date(times[0]);
  const fm = first.getHours() * 60 + first.getMinutes();
  const items = r.kind === 'reminder' ? '' : ` · ${r.slots.length} item${r.slots.length === 1 ? '' : 's'}`;
  return `${fmtMinFull(fm)}${items}`;
}

export function newItem(partial: Partial<Item> = {}): Item {
  return {
    id: uid('i'),
    title: 'New item',
    detail: '',
    note: '',
    icon: 'task',
    color: '#2563D0',
    number: '',
    doneLabel: 'Done',
    ...partial,
  };
}

/** Creates and saves an empty routine or a one-item reminder, returning its id. */
export function createRoutine(kind: 'routine' | 'reminder'): string {
  const st = useStore.getState();
  const nowD = new Date();
  const nextHour = Math.min(23, nowD.getHours() + 1) * 60;
  const colors = ['green', 'pink', 'teal', 'violet', 'blue', 'amber', 'coral', 'indigo'];
  const color = colors[st.routines.length % colors.length];
  const id = uid('r');
  if (kind === 'reminder') {
    const item = newItem({ title: 'New reminder', icon: 'bell' });
    st.saveItem(item);
    st.saveRoutine({
      id,
      kind,
      name: 'New reminder',
      icon: 'bell',
      color,
      startMin: nextHour,
      gapMin: 0,
      repeat: { type: 'daily' },
      slots: [{ id: uid('s'), itemId: item.id, fixedMin: null }],
      active: true,
    });
  } else {
    st.saveRoutine({ id, kind, name: 'New routine', icon: 'bolt', color, startMin: nextHour, gapMin: 10, repeat: { type: 'daily' }, slots: [], active: true });
  }
  return id;
}
