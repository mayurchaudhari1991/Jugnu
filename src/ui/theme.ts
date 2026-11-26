import type { ItemIcon, RoutineIcon } from '@/core/types';

export const C = {
  bg: '#F4F5F9',
  card: '#FFFFFF',
  ink: '#12172A',
  ink2: '#4D5468',
  ink3: '#6B7186',
  line: '#E4E6EE',
  line2: '#EEF0F5',
  chip: '#EEF0F5',
  done: '#0E9F6E',
  doneText: '#0A7A54',
  doneTint: '#E2F4EC',
  danger: '#B42318',
  dangerTint: '#FDE8E4',
  warnTint: '#FFF4E5',
  warnText: '#8A4B00',
  night: '#0F1A3C',
  night2: '#1A2550',
  night3: '#2A3560',
  glow: '#FFE45C',
  glowSoft: '#FFF3B0',
  ember: '#FF8A3D',
  onNight: '#FFFFFF',
  onNight2: '#C9CEDC',
  onNight3: '#AEB5C8',
};

export const F = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  heavy: 'PlusJakartaSans_800ExtraBold',
  display: 'BricolageGrotesque_700Bold',
  displayHeavy: 'BricolageGrotesque_800ExtraBold',
};

/** Routine colours. `text` passes 4.5:1 on both white and `tint`; `onNight` is for dark cards. */
export type RoutineColor = { key: string; name: string; solid: string; tint: string; text: string; onNight: string };

export const ROUTINE_COLORS: RoutineColor[] = [
  { key: 'amber', name: 'Sunrise', solid: '#D9820A', tint: '#FFF1DA', text: '#8A5000', onNight: '#FFC46B' },
  { key: 'blue', name: 'Sky', solid: '#1F74D6', tint: '#E2EEFC', text: '#15559E', onNight: '#8DBDF5' },
  { key: 'coral', name: 'Sunset', solid: '#E2522F', tint: '#FDE6DF', text: '#A23A1F', onNight: '#FF9D84' },
  { key: 'indigo', name: 'Night', solid: '#5148D0', tint: '#EBE9FC', text: '#3A33A3', onNight: '#ABA6FF' },
  { key: 'green', name: 'Leaf', solid: '#15934A', tint: '#E2F4E8', text: '#0F6B36', onNight: '#7FDCA3' },
  { key: 'pink', name: 'Rose', solid: '#D6336C', tint: '#FCE6EE', text: '#A3214F', onNight: '#FF9DBF' },
  { key: 'teal', name: 'Teal', solid: '#0B8584', tint: '#DFF4F4', text: '#075E5D', onNight: '#6FD6D5' },
  { key: 'violet', name: 'Violet', solid: '#7C4DDB', tint: '#EFE8FD', text: '#5B2FB8', onNight: '#C3A8FF' },
];

export function routineColor(key: string): RoutineColor {
  return ROUTINE_COLORS.find((c) => c.key === key) ?? ROUTINE_COLORS[0];
}

/** Item colours: `c` for the icon stroke, `t` for its tile. */
export const ITEM_COLORS: { c: string; t: string; name: string }[] = [
  { c: '#6D4AE8', t: '#EFEBFF', name: 'Violet' },
  { c: '#0B8584', t: '#DFF4F4', name: 'Teal' },
  { c: '#2563D0', t: '#E4ECFC', name: 'Blue' },
  { c: '#C93A64', t: '#FCE6ED', name: 'Pink' },
  { c: '#C86A0C', t: '#FDEEDD', name: 'Orange' },
  { c: '#138443', t: '#E2F4E8', name: 'Green' },
  { c: '#946C00', t: '#F8F0D6', name: 'Mustard' },
  { c: '#8A5A3C', t: '#F4EAE3', name: 'Brown' },
  { c: '#5C6175', t: '#ECEDF2', name: 'Grey' },
];

export function itemTint(color: string): string {
  return ITEM_COLORS.find((c) => c.c.toLowerCase() === color.toLowerCase())?.t ?? '#ECEDF2';
}

export const ITEM_ICONS: { key: ItemIcon; label: string }[] = [
  { key: 'pills', label: 'Pills' },
  { key: 'tablet', label: 'Tablet' },
  { key: 'capsule', label: 'Capsule' },
  { key: 'drops', label: 'Drops' },
  { key: 'hair', label: 'Apply' },
  { key: 'task', label: 'Task' },
  { key: 'gym', label: 'Gym' },
  { key: 'walk', label: 'Walk' },
  { key: 'water', label: 'Water' },
  { key: 'book', label: 'Study' },
  { key: 'bill', label: 'Bill' },
  { key: 'phone', label: 'Call' },
  { key: 'cake', label: 'Birthday' },
  { key: 'bell', label: 'Other' },
];

export const ROUTINE_ICONS: RoutineIcon[] = ['sunrise', 'sun', 'sunset', 'moon', 'bolt', 'heart', 'star', 'bell'];

/** Content stays readable on tablets and folds. */
export const MAX_W = 620;
