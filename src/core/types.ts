/** Icon shown for an item. The first five are medicine forms; the rest cover any reminder. */
export type ItemIcon =
  | 'pills'
  | 'drops'
  | 'tablet'
  | 'capsule'
  | 'hair'
  | 'task'
  | 'gym'
  | 'water'
  | 'bill'
  | 'book'
  | 'phone'
  | 'walk'
  | 'cake'
  | 'bell';

export type RoutineIcon = 'sunrise' | 'sun' | 'sunset' | 'moon' | 'bolt' | 'star' | 'heart' | 'bell';

/** A thing to do: a medicine, an exercise, a bill, anything. */
export type Item = {
  id: string;
  title: string;
  /** What to do, e.g. "5 pills · suck slowly" or "3 sets of 12". */
  detail: string;
  note: string;
  icon: ItemIcon;
  /** Hex of one of ITEM_COLORS. */
  color: string;
  /** Optional label like a prescription number. Shown as "#6". */
  number: string;
  /** Word on the main alarm button: "Taken" for medicine, "Done" for everything else. */
  doneLabel: string;
};

/** One place an item sits inside a routine. */
export type Slot = {
  id: string;
  itemId: string;
  /** Minutes after midnight when this slot has its own time (outside the chain). */
  fixedMin: number | null;
};

export type Repeat =
  | { type: 'daily' }
  | { type: 'weekly'; days: number[] } // 0 = Sunday … 6 = Saturday
  | { type: 'monthly'; day: number } // 1 … 31
  | { type: 'yearly'; month: number; day: number } // month 1 … 12
  | { type: 'once'; date: string }; // YYYY-MM-DD

/**
 * A routine rings its items one after another, `gapMin` apart, starting at `startMin`.
 * A single reminder is a routine with one item (kind: 'reminder').
 */
export type Routine = {
  id: string;
  kind: 'routine' | 'reminder';
  name: string;
  icon: RoutineIcon;
  /** Key of one of ROUTINE_COLORS. */
  color: string;
  startMin: number;
  gapMin: number;
  repeat: Repeat;
  slots: Slot[];
  active: boolean;
  /** Its own alarm sound; null/undefined = the default from Settings. */
  sound?: Sound | null;
};

/** An alarm sound. uri '' = the phone's default alarm. */
export type Sound = { uri: string; title: string };

/** Vibration while an alarm rings. */
export type Vibe = 'pulse' | 'heartbeat' | 'long' | 'gentle' | 'off';

export type Settings = {
  /** Default alarm sound for every routine that doesn't pick its own. */
  sound: Sound;
  snoozeMin: number;
  /** Vibration pattern while ringing. */
  vibrate: Vibe;
  /** Total rings when nobody answers (first ring plus re-rings). */
  maxRings: number;
  /** How long each ring keeps sounding before it goes quiet until the next re-ring. */
  ringSec: number;
  setupDone: boolean;
  /** The person confirmed the phone-maker step (e.g. ColorOS "Allow background activity"). */
  oemDone: boolean;
  /** When tracking began (first launch). Doses planned earlier are neither rung nor counted as missed. */
  trackFrom: number;
};

export type LogStatus = 'done' | 'skipped' | 'missed';

/** What happened to one dose on one day. */
export type LogEntry = {
  status?: LogStatus;
  /** When it was done/skipped (epoch ms). */
  at?: number;
  snoozeUntil?: number;
  snoozes?: number;
};

/** Keyed by `${routineId}:${slotId}`. */
export type DayLog = Record<string, LogEntry>;

export type DoseStatus = LogStatus | 'pending';

/** One ring of one item on one day, after the chain rules are applied. */
export type Dose = {
  /** `${routineId}:${slotId}` — unique within a day. */
  key: string;
  /** `${date}|${key}` — unique forever, used as the native alarm id. */
  alarmId: string;
  date: string;
  routine: Routine;
  item: Item;
  slot: Slot;
  /** Position within the routine (0-based) and routine size. */
  index: number;
  of: number;
  /** Planned time, epoch ms. */
  planned: number;
  /** When it rings (or rang), after late answers and snoozes push it. */
  at: number;
  status: DoseStatus;
  actedAt?: number;
  snoozes: number;
  snoozed: boolean;
  fixed: boolean;
};

export type Config = {
  items: Record<string, Item>;
  routines: Routine[];
  settings: Settings;
};
