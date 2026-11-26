import { SEED_ITEMS, SEED_KIND, SEED_ROUTINES } from './seed-data';
import type { Config, Item, Routine } from './types';

/** True in your own build (starts with your prescription); false in the build you share. */
export const IS_PERSONAL = SEED_KIND === 'personal';

export function seedConfig(): Config {
  return {
    items: Object.fromEntries(SEED_ITEMS.map((i) => [i.id, { ...i }])),
    routines: SEED_ROUTINES.map((r) => ({ ...r, slots: r.slots.map((s) => ({ ...s })) })),
    settings: { sound: { uri: '', title: 'Phone default alarm' }, snoozeMin: 10, vibrate: 'pulse', maxRings: 3, ringSec: 120, setupDone: false, oemDone: false, trackFrom: 0 },
  };
}

const ex = (id: string, title: string, detail: string, icon: Item['icon'], color: string, doneLabel = 'Done'): Item => ({
  id,
  title,
  detail,
  note: '',
  icon,
  color,
  number: '',
  doneLabel,
});

/** A few everyday examples so a new person can see how routines and reminders work. */
export function exampleConfig(): { items: Item[]; routines: Routine[] } {
  const items = [
    ex('ex-vitd', 'Vitamin D', '1 tablet after breakfast', 'tablet', '#C86A0C', 'Taken'),
    ex('ex-multi', 'Multivitamin', '1 capsule with water', 'capsule', '#C93A64', 'Taken'),
    ex('ex-water', 'Drink water', '1 big glass', 'water', '#2563D0'),
    ex('ex-walk', 'Evening walk', '20 minutes, any pace', 'walk', '#138443'),
    ex('ex-bill', 'Pay phone bill', 'Check the amount first', 'bill', '#6D4AE8'),
  ];
  const routines: Routine[] = [
    {
      id: 'ex-morning',
      kind: 'routine',
      name: 'Morning vitamins',
      icon: 'sunrise',
      color: 'amber',
      startMin: 9 * 60,
      gapMin: 10,
      repeat: { type: 'daily' },
      slots: [
        { id: 'ex-morning-1', itemId: 'ex-vitd', fixedMin: null },
        { id: 'ex-morning-2', itemId: 'ex-multi', fixedMin: null },
      ],
      active: true,
    },
    {
      id: 'ex-water-r',
      kind: 'routine',
      name: 'Water breaks',
      icon: 'heart',
      color: 'blue',
      startMin: 11 * 60,
      gapMin: 0,
      repeat: { type: 'daily' },
      slots: [
        { id: 'ex-water-1', itemId: 'ex-water', fixedMin: 11 * 60 },
        { id: 'ex-water-2', itemId: 'ex-water', fixedMin: 14 * 60 },
        { id: 'ex-water-3', itemId: 'ex-water', fixedMin: 17 * 60 },
      ],
      active: true,
    },
    {
      id: 'ex-walk-r',
      kind: 'reminder',
      name: 'Evening walk',
      icon: 'bolt',
      color: 'green',
      startMin: 18 * 60 + 30,
      gapMin: 0,
      repeat: { type: 'weekly', days: [1, 2, 3, 4, 5] },
      slots: [{ id: 'ex-walk-1', itemId: 'ex-walk', fixedMin: null }],
      active: true,
    },
    {
      id: 'ex-bill-r',
      kind: 'reminder',
      name: 'Pay phone bill',
      icon: 'bell',
      color: 'violet',
      startMin: 10 * 60,
      gapMin: 0,
      repeat: { type: 'monthly', day: 5 },
      slots: [{ id: 'ex-bill-1', itemId: 'ex-bill', fixedMin: null }],
      active: true,
    },
  ];
  return { items, routines };
}
