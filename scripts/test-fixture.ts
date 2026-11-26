// Anonymous copy of a real 9-medicine schedule (same routines, times and rules; generic names).
// The schedule tests run against this so they need no personal data.
import type { Item, Routine, Slot } from '../src/core/types';

const med = (id: string, number: string, title: string, detail: string, icon: Item['icon'], color: string): Item => ({
  id,
  title,
  detail,
  note: '',
  icon,
  color,
  number,
  doneLabel: 'Taken',
});

export const SEED_ITEMS: Item[] = [
  med('m1', '1', 'Medicine 1', '1 tablet', 'pills', '#6D4AE8'),
  med('m2', '2', 'Medicine 2', '1 tablet', 'drops', '#0B8584'),
  med('m3', '3', 'Medicine 3', '1 tablet', 'drops', '#2563D0'),
  med('m4', '4', 'Medicine 4', '1 tablet', 'hair', '#8A5A3C'),
  med('m5', '5', 'Medicine 5', '1 tablet', 'capsule', '#C93A64'),
  med('m6', '6', 'Medicine 6', '1 tablet', 'tablet', '#C86A0C'),
  med('m7', '7', 'Medicine 7', '1 tablet', 'pills', '#138443'),
  med('m8', '8', 'Medicine 8', '1 tablet', 'hair', '#5C6175'),
  med('m9', '9', 'Medicine 9', '1 tablet', 'pills', '#946C00'),
];

const chain = (routine: string, ids: string[]): Slot[] =>
  ids.map((itemId) => ({ id: `${routine}-${itemId}`, itemId, fixedMin: null }));

const fixed = (routine: string, itemId: string, min: number): Slot => ({ id: `${routine}-${itemId}`, itemId, fixedMin: min });

/** #1, #2, #3, #5 are 3× a day (no evening); #6, #7, #9 are 4× a day. */
const MAIN = ['m1', 'm2', 'm3', 'm5', 'm6', 'm7', 'm9'];

export const SEED_ROUTINES: Routine[] = [
  {
    id: 'morning',
    kind: 'routine',
    name: 'Morning',
    icon: 'sunrise',
    color: 'amber',
    startMin: 8 * 60,
    gapMin: 10,
    repeat: { type: 'daily' },
    slots: [fixed('morning', 'm8', 7 * 60 + 30), ...chain('morning', MAIN)],
    active: true,
  },
  {
    id: 'afternoon',
    kind: 'routine',
    name: 'Afternoon',
    icon: 'sun',
    color: 'blue',
    startMin: 12 * 60,
    gapMin: 10,
    repeat: { type: 'daily' },
    slots: chain('afternoon', MAIN),
    active: true,
  },
  {
    id: 'evening',
    kind: 'routine',
    name: 'Evening',
    icon: 'sunset',
    color: 'coral',
    startMin: 16 * 60,
    gapMin: 10,
    repeat: { type: 'daily' },
    slots: chain('evening', ['m6', 'm7', 'm9']),
    active: true,
  },
  {
    id: 'night',
    kind: 'routine',
    name: 'Night',
    icon: 'moon',
    color: 'indigo',
    startMin: 21 * 60,
    gapMin: 10,
    repeat: { type: 'daily' },
    slots: [...chain('night', MAIN), fixed('night', 'm4', 23 * 60)],
    active: true,
  },
];
