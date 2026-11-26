import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useNow } from '@/core/hooks';
import { planDay } from '@/core/schedule';
import { getConfig, useStore } from '@/core/store';
import { addDays, fmtTimeFull, parseDateKey, todayKey, WEEKDAYS_SHORT } from '@/core/time';
import type { Dose } from '@/core/types';
import { ItemTile } from '@/ui/dose';
import { Card, Chip, Screen } from '@/ui/kit';
import { C, routineColor } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

type DayStat = { date: string; total: number; done: number; skipped: number; missed: number; doses: Dose[]; today: boolean };

export default function History() {
  const now = useNow(60000);
  const rev = useStore((s) => s.rev);
  const [range, setRange] = useState<7 | 30>(7);
  const today = todayKey(now);

  const days: DayStat[] = useMemo(() => {
    const cfg = getConfig();
    const logs = useStore.getState().logs;
    const out: DayStat[] = [];
    for (let i = range - 1; i >= 0; i--) {
      const date = addDays(today, -i);
      const doses = planDay(cfg, date, logs[date] ?? {})
        .flatMap((r) => r.doses)
        .filter((d) => !(d.status === 'pending' && d.at < cfg.settings.trackFrom));
      const isToday = date === today;
      // Past days with no answer recorded count as missed.
      const resolved = doses.map((d) => (!isToday && d.status === 'pending' ? { ...d, status: 'missed' as const } : d));
      out.push({
        date,
        today: isToday,
        doses: resolved,
        total: resolved.length,
        done: resolved.filter((d) => d.status === 'done').length,
        skipped: resolved.filter((d) => d.status === 'skipped').length,
        missed: resolved.filter((d) => d.status === 'missed').length,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev, today, range]);

  const past = days.filter((d) => !d.today && d.total > 0);
  const done = past.reduce((a, d) => a + d.done, 0);
  const total = past.reduce((a, d) => a + d.total, 0);
  const pct = total ? Math.round((done / total) * 100) : null;
  let streak = 0;
  for (let i = past.length - 1; i >= 0 && past[i].done === past[i].total; i--) streak++;
  const maxTotal = Math.max(1, ...days.map((d) => d.total));

  const byRoutine = useMemo(() => {
    const m = new Map<string, { name: string; color: string; done: number; total: number }>();
    for (const d of past.flatMap((x) => x.doses)) {
      const e = m.get(d.routine.id) ?? { name: d.routine.name, color: d.routine.color, done: 0, total: 0 };
      e.total++;
      if (d.status === 'done') e.done++;
      m.set(d.routine.id, e);
    }
    return [...m.values()];
  }, [past]);

  const misses = days
    .flatMap((d) => d.doses)
    .filter((d) => d.status === 'missed' || d.status === 'skipped')
    .sort((a, b) => b.at - a.at)
    .slice(0, 12);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ gap: 4, flexShrink: 1 }}>
          <Txt display size={32} weight="bold" lh={1.1}>
            History
          </Txt>
          <Txt size={15} color={C.ink2}>
            Last {range} days
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Chip label="Week" on={range === 7} onPress={() => setRange(7)} />
          <Chip label="Month" on={range === 30} onPress={() => setRange(30)} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1, backgroundColor: C.night, borderRadius: 20, padding: 16, gap: 4 }}>
          <Txt display size={36} weight="bold" color="#FFFFFF" lh={1} maxFontSizeMultiplier={1.2}>
            {pct == null ? '–' : `${pct}%`}
          </Txt>
          <Txt size={13} weight="bold" color="#FFFFFF">
            done
          </Txt>
          <Txt size={12} color={C.onNight2}>
            {total ? `${done} of ${total}, before today` : 'Your first full day counts from tomorrow'}
          </Txt>
        </View>
        <Card style={{ flex: 1, gap: 4 }}>
          <Txt display size={36} weight="bold" color={C.doneText} lh={1} maxFontSizeMultiplier={1.2}>
            {streak}
          </Txt>
          <Txt size={13} weight="bold">
            day streak
          </Txt>
          <Txt size={12} color={C.ink2}>
            every reminder done, in a row
          </Txt>
        </Card>
      </View>

      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Txt size={15} weight="heavy">
            Done per day
          </Txt>
          <Txt size={12} weight="semibold" color={C.ink2}>
            {range} days
          </Txt>
        </View>
        <View
          accessible
          accessibilityLabel={days.map((d) => `${WEEKDAYS_SHORT[parseDateKey(d.date).getDay()]} ${d.done} of ${d.total}`).join(', ')}
          style={{ flexDirection: 'row', alignItems: 'flex-end', gap: range === 7 ? 8 : 3, height: 150 }}
        >
          {days.map((d) => {
            const h = d.total ? Math.max(6, (d.done / maxTotal) * 120) : 6;
            const full = d.total > 0 && d.done === d.total;
            const color = d.today ? '#A3AABD' : full ? C.done : d.total ? '#F0B44C' : '#E4E6EE';
            return (
              <View key={d.date} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                {range === 7 ? (
                  <Txt size={11.5} weight="heavy" color={full ? C.doneText : C.ink}>
                    {d.total ? d.done : ''}
                  </Txt>
                ) : null}
                <View style={{ width: '100%', height: 120, justifyContent: 'flex-end', backgroundColor: '#F1F2F6', borderRadius: range === 7 ? 10 : 4, overflow: 'hidden' }}>
                  <View style={{ height: h, backgroundColor: color, borderRadius: range === 7 ? 10 : 4 }} />
                </View>
                {range === 7 ? (
                  <Txt size={11.5} weight="bold" color={C.ink2}>
                    {d.today ? 'Today' : WEEKDAYS_SHORT[parseDateKey(d.date).getDay()]}
                  </Txt>
                ) : null}
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          <Legend color={C.done} label="All done" />
          <Legend color="#F0B44C" label="Some missed" />
          <Legend color="#A3AABD" label="Today so far" />
        </View>
      </Card>

      {byRoutine.length > 0 ? (
        <Card style={{ gap: 12 }}>
          <Txt size={15} weight="heavy">
            By routine
          </Txt>
          {byRoutine.map((r) => {
            const rc = routineColor(r.color);
            return (
              <View key={r.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Txt size={13} weight="bold" color={rc.text} style={{ width: 92 }} numberOfLines={1}>
                  {r.name}
                </Txt>
                <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: '#ECEEF3', overflow: 'hidden' }}>
                  <View style={{ width: `${(r.done / r.total) * 100}%`, height: '100%', backgroundColor: rc.solid, borderRadius: 5 }} />
                </View>
                <Txt size={13} weight="bold" style={{ width: 52 }} align="right">
                  {r.done}/{r.total}
                </Txt>
              </View>
            );
          })}
        </Card>
      ) : null}

      <Card style={{ gap: 4 }}>
        <Txt size={15} weight="heavy" style={{ marginBottom: 6 }}>
          Missed and skipped
        </Txt>
        {misses.length === 0 ? (
          <Txt size={13.5} color={C.ink2}>
            Nothing missed. Keep it up.
          </Txt>
        ) : (
          misses.map((d) => (
            <View key={d.alarmId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.line2 }}>
              <ItemTile item={d.item} size={34} radius={10} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt size={14} weight="bold" numberOfLines={1}>
                  {d.item.title}
                </Txt>
                <Txt size={12} color={C.ink2}>
                  {d.date === today ? 'Today' : WEEKDAYS_SHORT[parseDateKey(d.date).getDay()]} · {d.routine.name} · {fmtTimeFull(d.at)}
                </Txt>
              </View>
              <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: d.status === 'missed' ? C.dangerTint : C.chip }}>
                <Txt size={12} weight="heavy" color={d.status === 'missed' ? '#A12B16' : '#3F4659'}>
                  {d.status === 'missed' ? 'Missed' : 'Skipped'}
                </Txt>
              </View>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <Txt size={12} weight="semibold" color={C.ink2}>
        {label}
      </Txt>
    </View>
  );
}
