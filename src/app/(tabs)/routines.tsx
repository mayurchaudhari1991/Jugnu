import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { cloudConfigured } from '@/core/cloud';
import { useNow, useToday } from '@/core/hooks';
import { createRoutine, repeatText, routineSummary } from '@/core/routines';
import { useStore } from '@/core/store';
import type { Routine } from '@/core/types';
import { Icon, RoutineGlyph } from '@/ui/icons';
import { Btn, Screen } from '@/ui/kit';
import { C, routineColor } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

export default function Routines() {
  const routines = useStore((s) => s.routines);
  const now = useNow();
  const { days } = useToday(now);
  const progress = Object.fromEntries(days.map((d) => [d.routine.id, `${d.doses.filter((x) => x.status === 'done').length}/${d.doses.length}`]));
  const list = [...routines].sort((a, b) => a.startMin - b.startMin);
  const routineList = list.filter((r) => r.kind === 'routine');
  const reminders = list.filter((r) => r.kind === 'reminder');

  const add = (kind: 'routine' | 'reminder') => {
    const id = createRoutine(kind);
    router.push({ pathname: '/routine/[id]', params: { id, fresh: '1' } });
  };

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Txt display size={32} weight="bold" lh={1.1}>
          Routines
        </Txt>
        <Txt size={15} color={C.ink2}>
          Things that ring one after another, and single reminders.
        </Txt>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Btn label="Routine" icon="plus" onPress={() => add('routine')} style={{ flex: 1 }} a11y="New routine" />
        <Btn label="Reminder" icon="plus" kind="secondary" onPress={() => add('reminder')} style={{ flex: 1 }} a11y="New reminder" />
      </View>
      {cloudConfigured ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Btn label="Scan prescription" kind="secondary" onPress={() => router.push('/scan')} style={{ flex: 1 }} a11y="Scan a prescription with Jugnu AI" />
          <Btn label="Type it" kind="secondary" onPress={() => router.push('/quick')} style={{ flex: 1 }} a11y="Type a reminder for Jugnu AI" />
        </View>
      ) : null}

      <Group title="Routines" count={routineList.length} hint="A list of things, a few minutes apart: medicines, a workout, a study plan.">
        {routineList.map((r) => (
          <RoutineCard key={r.id} r={r} progress={progress[r.id]} />
        ))}
      </Group>

      <Group title="Reminders" count={reminders.length} hint="One thing at one time: a bill, a call, a birthday.">
        {reminders.map((r) => (
          <RoutineCard key={r.id} r={r} progress={progress[r.id]} />
        ))}
      </Group>
    </Screen>
  );
}

function Group({ title, count, hint, children }: { title: string; count: number; hint: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 }}>
        <Txt size={13} weight="heavy" color={C.ink2} style={{ letterSpacing: 0.7, textTransform: 'uppercase' }}>
          {title}
        </Txt>
        <Txt size={13} weight="semibold" color={C.ink2}>
          {count}
        </Txt>
      </View>
      {count === 0 ? (
        <View style={{ padding: 16, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: '#C9CDD8' }}>
          <Txt size={13.5} color={C.ink2}>
            {hint}
          </Txt>
        </View>
      ) : (
        children
      )}
    </View>
  );
}

function RoutineCard({ r, progress }: { r: Routine; progress?: string }) {
  const rc = routineColor(r.color);
  const items = useStore((s) => s.items);
  const firstItem = r.kind === 'reminder' ? items[r.slots[0]?.itemId] : null;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/routine/[id]', params: { id: r.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${r.name}. ${routineSummary(r)}. ${repeatText(r.repeat)}${r.active ? '' : '. Paused'}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, opacity: pressed ? 0.85 : 1 })}
    >
      <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: rc.tint, alignItems: 'center', justifyContent: 'center', opacity: r.active ? 1 : 0.5 }}>
        <RoutineGlyph icon={r.icon} color={rc.solid} size={22} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt size={16} weight="heavy" color={r.active ? C.ink : C.ink2} numberOfLines={1}>
          {r.kind === 'reminder' && firstItem ? firstItem.title : r.name}
        </Txt>
        <Txt size={13} color={C.ink2} numberOfLines={2}>
          {routineSummary(r)} · {repeatText(r.repeat)}
        </Txt>
      </View>
      {!r.active ? (
        <View style={{ backgroundColor: C.chip, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
          <Txt size={12} weight="bold" color={C.ink2}>
            Paused
          </Txt>
        </View>
      ) : progress ? (
        <View style={{ backgroundColor: rc.tint, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 }}>
          <Txt size={12.5} weight="heavy" color={rc.text}>
            {progress}
          </Txt>
        </View>
      ) : null}
      <Icon name="chevR" size={18} color={C.ink3} />
    </Pressable>
  );
}
