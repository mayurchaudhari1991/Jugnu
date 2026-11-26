import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { act } from '@/core/engine';
import { isAnswerable } from '@/core/schedule';
import JugnuAlarm from '../../../modules/jugnu-alarm';
import { makerTip, useNow, usePermissions, useToday } from '@/core/hooks';
import { useStore } from '@/core/store';
import { fmtDateLong, fmtTime, fmtTimeFull, relative } from '@/core/time';
import type { Dose } from '@/core/types';
import { DoseRow, DoseSheet, doseSub, ItemTile } from '@/ui/dose';
import { Icon, JugnuMark, RoutineGlyph } from '@/ui/icons';
import { Banner, Btn, Screen, SectionTitle } from '@/ui/kit';
import { C, routineColor } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

function greeting(now: number) {
  const h = new Date(now).getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

export default function Today() {
  const now = useNow();
  const { date, days } = useToday(now);
  const settings = useStore((s) => s.settings);
  const snoozeMin = settings.snoozeMin;
  const { allOk } = usePermissions();
  const lockMiss = useLockMiss(now);
  const needsMakerStep = !!makerTip() && settings.setupDone && !settings.oemDone;
  const [picked, setPicked] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Dose | null>(null);

  const all = useMemo(() => days.flatMap((d) => d.doses), [days]);
  const doneCount = all.filter((d) => d.status === 'done').length;
  const next = all.filter((d) => isAnswerable(d, settings, now)).sort((a, b) => a.at - b.at)[0] ?? null;

  const selectedId = picked && days.some((d) => d.routine.id === picked) ? picked : (next?.routine.id ?? days[0]?.routine.id ?? null);
  const selected = days.find((d) => d.routine.id === selectedId) ?? null;

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Txt size={13} weight="semibold" color={C.ink2}>
              {fmtDateLong(date)}
            </Txt>
            <Txt display size={32} weight="bold" lh={1.1}>
              {greeting(now)}
            </Txt>
            {all.length > 0 ? (
              <Txt size={15} color={C.ink2}>
                <Txt size={15} weight="heavy">
                  {doneCount} of {all.length}
                </Txt>{' '}
                done today
              </Txt>
            ) : null}
          </View>
          <View style={{ borderRadius: 14, overflow: 'hidden' }}>
            <JugnuMark size={48} />
          </View>
        </View>

        {!allOk ? (
          <Banner text="Alarms can't fill your lock screen yet. A few phone settings need a tap." action="Fix" onPress={() => router.push('/settings')} />
        ) : needsMakerStep ? (
          <Banner
            text={`Jugnu was updated. Please check "${makerTip()?.title}" is still on for Jugnu, so alarms keep working on the lock screen.`}
            action="Fix"
            onPress={() => router.push('/settings')}
          />
        ) : lockMiss ? (
          <Banner
            text={lockMiss}
            action="Fix"
            onPress={() => {
              JugnuAlarm?.clearLockHealth();
              useStore.getState().setSettings({ oemDone: false });
              router.push('/settings');
            }}
          />
        ) : null}

        {all.length > 0 ? <DayStrip days={days} /> : null}

        {days.length > 0 ? (
          <ChipRow fit={days.length <= 4}>
            {days.map(({ routine, doses }) => {
              const rc = routineColor(routine.color);
              const on = routine.id === selectedId;
              const done = doses.filter((d) => d.status === 'done').length;
              const t = fmtTime(doses[0].at);
              return (
                <Pressable
                  key={routine.id}
                  onPress={() => setPicked(routine.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${routine.name}, ${done} of ${doses.length} done`}
                  style={{
                    ...(days.length <= 4 ? { flex: 1, minWidth: 0 } : { width: 92 }),
                    paddingTop: 10,
                    paddingHorizontal: 8,
                    paddingBottom: 11,
                    gap: 5,
                    borderRadius: 16,
                    borderWidth: 2,
                    borderColor: on ? rc.solid : C.line,
                    backgroundColor: on ? rc.tint : C.card,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 22 }}>
                    <RoutineGlyph icon={routine.icon} color={rc.solid} size={20} />
                    {done === doses.length ? (
                      <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: C.done, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="check" size={12} color="#FFFFFF" stroke={3.5} />
                      </View>
                    ) : null}
                  </View>
                  <Txt size={11.5} weight="bold" color={rc.text} numberOfLines={1}>
                    {routine.name}
                  </Txt>
                  <Txt display size={21} weight="bold" lh={1} maxFontSizeMultiplier={1.3}>
                    {done}/{doses.length}
                  </Txt>
                  <Txt size={11} weight="medium" color={C.ink2}>
                    {t.time} {t.ap}
                  </Txt>
                </Pressable>
              );
            })}
          </ChipRow>
        ) : null}

        {next ? <NextCard d={next} now={now} /> : all.length > 0 ? <AllDone quiet={all.some((d) => d.status === 'pending')} /> : <Empty />}

        {selected ? (
          <View style={{ gap: 10 }}>
            <SectionTitle
              right={
                <Txt size={13} weight="semibold" color={C.ink2}>
                  {selected.doses.length} items · {fmtTimeFull(selected.doses[0].at)} – {fmtTimeFull(selected.doses[selected.doses.length - 1].at)}
                </Txt>
              }
            >
              {selected.routine.name}
            </SectionTitle>
            {selected.doses.map((d) => (
              <DoseRow key={d.key} d={d} onOpen={setSheet} />
            ))}
          </View>
        ) : null}
      </Screen>
      <DoseSheet d={sheet} onClose={() => setSheet(null)} snoozeMin={snoozeMin} />
    </View>
  );
}

/** Routine cards: share the width when they fit, scroll sideways when there are more than 4. */
function ChipRow({ fit, children }: { fit: boolean; children: React.ReactNode }) {
  if (fit) return <View style={{ flexDirection: 'row', gap: 8 }}>{children}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
      {children}
    </ScrollView>
  );
}

function DayStrip({ days }: { days: ReturnType<typeof useToday>['days'] }) {
  const all = days.flatMap((d) => d.doses);
  const done = all.filter((d) => d.status === 'done').length;
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={`${done} of ${all.length} done today`} style={{ flexDirection: 'row', gap: 8 }}>
      {days.map(({ routine, doses }) => {
        const rc = routineColor(routine.color);
        return (
          <View key={routine.id} style={{ flex: doses.length, flexDirection: 'row', gap: 3 }}>
            {doses.map((d) => (
              <View
                key={d.key}
                style={{
                  flex: 1,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: d.status === 'done' ? rc.solid : d.status === 'missed' ? '#F2B8AE' : d.status === 'skipped' ? '#C9CDD8' : '#DCDFE8',
                }}
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}

function NextCard({ d, now }: { d: Dose; now: number }) {
  const rc = routineColor(d.routine.color);
  const t = fmtTime(d.at);
  // Whole clock minutes, so a shift of a few seconds (12:40:00 → 12:40:36) doesn't say "moved".
  const shift = Math.floor(d.at / 60000) - Math.floor(d.planned / 60000);
  const snoozeMin = useStore((s) => s.settings.snoozeMin);
  return (
    <View style={{ backgroundColor: C.night, borderRadius: 24, padding: 18, gap: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <Txt size={11.5} weight="heavy" color={rc.onNight} style={{ letterSpacing: 0.8, textTransform: 'uppercase', flexShrink: 1 }}>
          Up next · {relative(d.at, now)}
        </Txt>
        <Txt size={12} weight="semibold" color={C.onNight2} numberOfLines={1}>
          {d.routine.name}
          {d.of > 1 ? ` · ${d.index + 1} of ${d.of}` : ''}
        </Txt>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <ItemTile item={d.item} size={56} radius={16} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Txt display size={34} weight="bold" color="#FFFFFF" lh={1.05} maxFontSizeMultiplier={1.2}>
              {t.time}
            </Txt>
            <Txt size={14} weight="bold" color={C.onNight2}>
              {t.ap}
            </Txt>
          </View>
          <Txt size={17} weight="bold" color="#FFFFFF" lh={1.25}>
            {d.item.title}
          </Txt>
          <Txt size={13.5} color={C.onNight2}>
            {doseSub(d)}
          </Txt>
        </View>
      </View>
      {shift > 0 ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
          <Icon name="clock" size={16} color={C.onNight2} />
          <Txt size={12.5} color={C.onNight2} style={{ flex: 1 }}>
            {d.snoozed
              ? `Snoozed, so moved from ${fmtTimeFull(d.planned)}. The rest of the routine moves with it.`
              : `Moved from ${fmtTimeFull(d.planned)} so there's a full ${d.routine.gapMin} min after the last one.`}
          </Txt>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Btn
          label={`${d.item.doneLabel || 'Done'} now`}
          icon="check"
          kind="light"
          style={{ flex: 1 }}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            act(d, 'done');
          }}
        />
        <Btn label={`Snooze ${snoozeMin} min`} kind="onDark" style={{ paddingHorizontal: 14 }} onPress={() => act(d, 'snooze')} />
      </View>
    </View>
  );
}

function AllDone({ quiet }: { quiet: boolean }) {
  return (
    <View style={{ backgroundColor: quiet ? C.night : C.done, borderRadius: 24, padding: 20, gap: 6 }}>
      <Txt display size={24} weight="bold" color="#FFFFFF">
        {quiet ? 'Nothing more today' : 'All done for today'}
      </Txt>
      <Txt size={14} color="#FFFFFF">
        {quiet ? 'No more alarms today. Jugnu lights up again tomorrow.' : 'Every reminder is ticked. Jugnu will light up again tomorrow.'}
      </Txt>
    </View>
  );
}

function Empty() {
  return (
    <View style={{ backgroundColor: C.night, borderRadius: 24, padding: 20, gap: 12, alignItems: 'flex-start' }}>
      <Txt display size={22} weight="bold" color="#FFFFFF">
        Nothing to remind you today
      </Txt>
      <Txt size={14} color={C.onNight2}>
        Add a routine (medicines, gym, study) or a single reminder (a bill, a birthday).
      </Txt>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <Btn label="Add a routine" icon="plus" kind="light" onPress={() => router.push('/routines')} />
        {useStore.getState().routines.length === 0 ? (
          <Btn label="Try examples" kind="onDark" onPress={() => useStore.getState().loadExamples()} />
        ) : null}
      </View>
    </View>
  );
}

/**
 * The phone blocked the alarm page over the lock screen at the last locked ring (it only showed
 * the notification). Phone makers sometimes switch "background activity" back off on their own.
 */
function useLockMiss(now: number): string | null {
  const h = JugnuAlarm?.getLockHealth();
  if (!h || !h.lastMiss || h.lastMiss < h.lastOk || now - h.lastMiss > 3 * 86400000) return null;
  const tip = makerTip();
  const where = tip ? ` Check "${tip.title}" in Settings.` : ' Check Settings.';
  return `Your last alarm couldn't open over the lock screen by itself.${where}`;
}
