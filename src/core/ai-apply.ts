// Turns what Jugnu AI read into real items, routines and reminders.
import type { ParsedReminder, ScanItem } from './cloud';
import { newItem } from './routines';
import { useStore } from './store';
import { uid } from './time';
import type { ItemIcon, Repeat, Routine, RoutineIcon } from './types';
import { ITEM_COLORS } from '@/ui/theme';

export type Part = 'morning' | 'afternoon' | 'evening' | 'night';

/** Where each part of the day starts when Jugnu has to create that routine. */
export const PARTS: { key: Part; label: string; startMin: number; icon: RoutineIcon; color: string }[] = [
  { key: 'morning', label: 'Morning', startMin: 8 * 60, icon: 'sunrise', color: 'amber' },
  { key: 'afternoon', label: 'Afternoon', startMin: 12 * 60, icon: 'sun', color: 'blue' },
  { key: 'evening', label: 'Evening', startMin: 16 * 60, icon: 'sunset', color: 'coral' },
  { key: 'night', label: 'Night', startMin: 21 * 60, icon: 'moon', color: 'indigo' },
];

function partOf(min: number): Part {
  if (min >= 4 * 60 && min < 11 * 60) return 'morning';
  if (min >= 11 * 60 && min < 15 * 60) return 'afternoon';
  if (min >= 15 * 60 && min < 18 * 60 + 30) return 'evening';
  return 'night';
}

const FORM_ICON: Record<string, ItemIcon> = {
  tablet: 'tablet',
  capsule: 'capsule',
  pills: 'pills',
  drops: 'drops',
  syrup: 'drops',
  hair: 'hair',
};

const FOOD: Record<string, string> = { before: 'before food', after: 'after food', with: 'with food', any: '' };

/** The existing daily routine for that part of the day, or a new one. */
function routineFor(part: Part, routines: Routine[]): Routine {
  const found = routines
    .filter((r) => r.kind === 'routine' && r.active && r.repeat.type === 'daily' && partOf(r.startMin) === part)
    .sort((a, b) => b.slots.length - a.slots.length)[0];
  if (found) return found;
  const p = PARTS.find((x) => x.key === part)!;
  return { id: uid('r'), kind: 'routine', name: p.label, icon: p.icon, color: p.color, startMin: p.startMin, gapMin: 10, repeat: { type: 'daily' }, slots: [], active: true };
}

/** Saves the reviewed medicines. Returns how many alarms a day were added. */
export function applyScan(items: (ScanItem & { keep: boolean })[]): number {
  const st = useStore.getState();
  const touched = new Map<string, Routine>();
  const current = () => [...st.routines.filter((r) => !touched.has(r.id)), ...touched.values()];
  let added = 0;
  const usedColors = new Set(Object.values(st.items).map((i) => i.color));
  const palette = [...ITEM_COLORS.filter((c) => !usedColors.has(c.c)), ...ITEM_COLORS];
  let n = 0;

  for (const it of items) {
    if (!it.keep || !it.name.trim()) continue;
    const food = FOOD[it.food] ?? '';
    const item = newItem({
      title: it.name.trim(),
      detail: [it.dose.trim(), food].filter(Boolean).join(' · '),
      note: [it.notes.trim(), it.days ? `For ${it.days} days` : ''].filter(Boolean).join('. '),
      icon: FORM_ICON[it.form] ?? 'pills',
      color: palette[n++ % palette.length].c,
      doneLabel: 'Taken',
    });
    st.saveItem(item);
    for (const part of it.times) {
      // current() includes routines already changed in this loop, so one new routine serves every item.
      const r = routineFor(part, current());
      const next = { ...r, slots: [...r.slots, { id: uid('s'), itemId: item.id, fixedMin: null }] };
      touched.set(next.id, next);
      added++;
    }
  }
  for (const r of touched.values()) st.saveRoutine(r);
  return added;
}

function toRepeat(r: ParsedReminder['repeat']): Repeat {
  switch (r.type) {
    case 'weekly':
      return { type: 'weekly', days: (r.days ?? []).filter((d) => d >= 0 && d <= 6).length ? (r.days ?? []).filter((d) => d >= 0 && d <= 6) : [new Date().getDay()] };
    case 'monthly':
      return { type: 'monthly', day: Math.min(31, Math.max(1, r.day ?? new Date().getDate())) };
    case 'yearly':
      return { type: 'yearly', month: Math.min(12, Math.max(1, r.month ?? new Date().getMonth() + 1)), day: Math.min(31, Math.max(1, r.day ?? new Date().getDate())) };
    case 'once':
      return /^\d{4}-\d{2}-\d{2}$/.test(r.date ?? '') ? { type: 'once', date: r.date! } : { type: 'daily' };
    default:
      return { type: 'daily' };
  }
}

const REMINDER_ICONS: ItemIcon[] = ['task', 'gym', 'water', 'bill', 'book', 'phone', 'walk', 'cake', 'bell', 'pills'];

/** Creates the reminder Jugnu AI read from a sentence and returns its routine id. */
export function applyReminder(p: ParsedReminder): string {
  const st = useStore.getState();
  const [h, m] = (p.time.match(/^(\d{1,2}):(\d{2})/)?.slice(1) ?? ['9', '0']).map(Number);
  const icon = REMINDER_ICONS.includes(p.icon as ItemIcon) ? (p.icon as ItemIcon) : 'bell';
  const item = newItem({ title: p.title.trim() || 'Reminder', detail: p.detail.trim(), icon, doneLabel: icon === 'pills' ? 'Taken' : 'Done' });
  st.saveItem(item);
  const colors = ['green', 'pink', 'teal', 'violet', 'blue', 'amber', 'coral', 'indigo'];
  const id = uid('r');
  st.saveRoutine({
    id,
    kind: 'reminder',
    name: item.title,
    icon: 'bell',
    color: colors[st.routines.length % colors.length],
    startMin: Math.min(23, Math.max(0, h)) * 60 + Math.min(59, Math.max(0, m)),
    gapMin: 0,
    repeat: toRepeat(p.repeat),
    slots: [{ id: uid('s'), itemId: item.id, fixedMin: null }],
    active: true,
  });
  return id;
}
