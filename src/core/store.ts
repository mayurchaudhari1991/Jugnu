import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { exampleConfig, seedConfig } from './seed';
import { addDays, todayKey } from './time';
import type { Config, DayLog, Item, LogEntry, Routine, Settings } from './types';

const CONFIG_KEY = 'jugnu:config:v1';
const LOG_PREFIX = 'jugnu:log:';
/** History older than this is dropped. */
const KEEP_DAYS = 400;

type State = Config & {
  logs: Record<string, DayLog>;
  hydrated: boolean;
  /** Bumped after every change, so screens and the alarm sync can react. */
  rev: number;
  hydrate(): void;
  saveItem(item: Item): void;
  deleteItem(id: string): void;
  saveRoutine(routine: Routine): void;
  deleteRoutine(id: string): void;
  setSettings(patch: Partial<Settings>): void;
  setLog(date: string, key: string, entry: LogEntry | null): void;
  resetAll(): void;
  loadExamples(): void;
};

function writeConfig(c: Config) {
  Storage.setItemSync(CONFIG_KEY, JSON.stringify({ items: c.items, routines: c.routines, settings: c.settings }));
}

function readConfig(): Config {
  const fresh = seedConfig();
  const raw = Storage.getItemSync(CONFIG_KEY);
  if (raw) {
    try {
      const c = JSON.parse(raw) as Config;
      return { items: c.items ?? {}, routines: c.routines ?? [], settings: { ...fresh.settings, ...c.settings } };
    } catch {
      // A broken save falls back to the seed rather than crashing.
    }
  }
  fresh.settings.trackFrom = Date.now();
  writeConfig(fresh);
  return fresh;
}

function readLogs(): Record<string, DayLog> {
  const oldest = addDays(todayKey(), -KEEP_DAYS);
  const logs: Record<string, DayLog> = {};
  for (const key of Storage.getAllKeysSync()) {
    if (!key.startsWith(LOG_PREFIX)) continue;
    const date = key.slice(LOG_PREFIX.length);
    if (date < oldest) {
      Storage.removeItemSync(key);
      continue;
    }
    try {
      logs[date] = JSON.parse(Storage.getItemSync(key) ?? '{}');
    } catch {
      logs[date] = {};
    }
  }
  return logs;
}

export const useStore = create<State>((set, get) => ({
  ...seedConfig(),
  logs: {},
  hydrated: false,
  rev: 0,

  hydrate() {
    if (get().hydrated) return;
    set({ ...readConfig(), logs: readLogs(), hydrated: true, rev: get().rev + 1 });
  },

  saveItem(item) {
    const items = { ...get().items, [item.id]: item };
    set({ items, rev: get().rev + 1 });
    writeConfig(get());
  },

  deleteItem(id) {
    const items = { ...get().items };
    delete items[id];
    const routines = get().routines.map((r) => ({ ...r, slots: r.slots.filter((s) => s.itemId !== id) }));
    set({ items, routines, rev: get().rev + 1 });
    writeConfig(get());
  },

  saveRoutine(routine) {
    const list = get().routines;
    const exists = list.some((r) => r.id === routine.id);
    const routines = exists ? list.map((r) => (r.id === routine.id ? routine : r)) : [...list, routine];
    set({ routines, rev: get().rev + 1 });
    writeConfig(get());
  },

  deleteRoutine(id) {
    const routines = get().routines.filter((r) => r.id !== id);
    // Items used only by this routine go with it.
    const used = new Set(routines.flatMap((r) => r.slots.map((s) => s.itemId)));
    const removed = get().routines.find((r) => r.id === id);
    const items = { ...get().items };
    removed?.slots.forEach((s) => {
      if (!used.has(s.itemId)) delete items[s.itemId];
    });
    set({ routines, items, rev: get().rev + 1 });
    writeConfig(get());
  },

  setSettings(patch) {
    set({ settings: { ...get().settings, ...patch }, rev: get().rev + 1 });
    writeConfig(get());
  },

  setLog(date, key, entry) {
    const day = { ...(get().logs[date] ?? {}) };
    if (entry) day[key] = entry;
    else delete day[key];
    set({ logs: { ...get().logs, [date]: day }, rev: get().rev + 1 });
    Storage.setItemSync(LOG_PREFIX + date, JSON.stringify(day));
  },

  loadExamples() {
    const ex = exampleConfig();
    const items = { ...get().items };
    ex.items.forEach((i) => (items[i.id] = i));
    const have = new Set(get().routines.map((r) => r.id));
    const routines = [...get().routines, ...ex.routines.filter((r) => !have.has(r.id))];
    set({ items, routines, rev: get().rev + 1 });
    writeConfig(get());
  },

  resetAll() {
    for (const key of Storage.getAllKeysSync()) {
      if (key.startsWith('jugnu:')) Storage.removeItemSync(key);
    }
    const fresh = seedConfig();
    fresh.settings.setupDone = true;
    fresh.settings.trackFrom = Date.now();
    writeConfig(fresh);
    set({ ...fresh, logs: {}, rev: get().rev + 1 });
  },
}));

export function getConfig(): Config {
  const s = useStore.getState();
  return { items: s.items, routines: s.routines, settings: s.settings };
}
