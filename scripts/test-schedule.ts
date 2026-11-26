// Checks the chain rules against the cases from the design. Run: npm run test:schedule
import { planDay, planRoutine, runsOn, upcomingDoses } from '../src/core/schedule';
import { seedConfig } from '../src/core/seed';
import { SEED_ITEMS, SEED_ROUTINES } from './test-fixture';
import { atMinute, fmtTimeFull } from '../src/core/time';
import type { DayLog } from '../src/core/types';

let failed = 0;
function eq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `\n     got  ${JSON.stringify(got)}\n     want ${JSON.stringify(want)}`}`);
}

// Settings from the app's defaults; items and routines from the anonymous fixture.
const cfg = { ...seedConfig(), items: Object.fromEntries(SEED_ITEMS.map((i) => [i.id, i])), routines: SEED_ROUTINES };
const D = '2026-11-16';
const t = (ms: number) => fmtTimeFull(ms);

// 1. Plain day: counts and times.
const day = planDay(cfg, D, {});
eq('4 routines', day.map((d) => d.routine.name), ['Morning', 'Afternoon', 'Evening', 'Night']);
eq('counts 8/7/3/8 = 26', day.map((d) => d.doses.length), [8, 7, 3, 8]);
eq('morning times', day[0].doses.map((d) => t(d.at)), ['7:30 AM', '8:00 AM', '8:10 AM', '8:20 AM', '8:30 AM', '8:40 AM', '8:50 AM', '9:00 AM']);
eq('evening times', day[2].doses.map((d) => t(d.at)), ['4:00 PM', '4:10 PM', '4:20 PM']);
eq('night ends with hair at 11', day[3].doses.map((d) => t(d.at)).slice(-2), ['10:00 PM', '11:00 PM']);

// 2. Late answer pushes the rest of the chain (the 12:20 → 12:22 example).
const aft = cfg.routines.find((r) => r.id === 'afternoon')!;
const log: DayLog = {
  'afternoon:afternoon-m1': { status: 'done', at: atMinute(D, 720) },
  'afternoon:afternoon-m2': { status: 'done', at: atMinute(D, 732) },
};
const a = planRoutine(aft, cfg, D, log);
eq('late answer shifts chain', a.map((d) => t(d.at)), ['12:00 PM', '12:10 PM', '12:22 PM', '12:32 PM', '12:42 PM', '12:52 PM', '1:02 PM']);

// 3. Answering early does not pull the next one earlier than planned.
const early: DayLog = { 'afternoon:afternoon-m1': { status: 'done', at: atMinute(D, 700) } };
eq('early answer keeps plan', planRoutine(aft, cfg, D, early).map((d) => t(d.at))[1], '12:10 PM');

// 4. Snooze moves that item and everything after it.
const snz: DayLog = {
  'afternoon:afternoon-m1': { status: 'done', at: atMinute(D, 720) },
  'afternoon:afternoon-m2': { snoozeUntil: atMinute(D, 740), snoozes: 1 },
};
const s = planRoutine(aft, cfg, D, snz);
eq('snooze moves item', t(s[1].at), '12:20 PM');
eq('snooze pushes next', t(s[2].at), '12:30 PM');

// 5. Fixed-time items ignore the chain.
const mor = cfg.routines.find((r) => r.id === 'morning')!;
const late7: DayLog = { 'morning:morning-m1': { status: 'done', at: atMinute(D, 8 * 60 + 25) } };
const m = planRoutine(mor, cfg, D, late7);
eq('fixed item stays at 7:30', t(m[0].at), '7:30 AM');
eq('chain after late first item', t(m[2].at), '8:35 AM');

// 6. Repeat rules.
eq('weekly', runsOn({ type: 'weekly', days: [1] }, '2026-11-16'), true);
eq('weekly off-day', runsOn({ type: 'weekly', days: [2] }, '2026-11-16'), false);
eq('monthly 31st in Feb', runsOn({ type: 'monthly', day: 31 }, '2027-02-28'), true);
eq('yearly', runsOn({ type: 'yearly', month: 11, day: 16 }, '2026-11-16'), true);
eq('once', runsOn({ type: 'once', date: '2026-11-17' }, '2026-11-16'), false);

// 7. Upcoming alarms from 12:14 today: skips past ones, covers 7 days.
const now = atMinute(D, 734);
const up = upcomingDoses(cfg, { [D]: log }, D, now, 7);
eq('first upcoming is 12:22', t(up[0].at), '12:22 PM');
eq('7-day total', up.length, 5 + 3 + 8 + 26 * 6);

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
