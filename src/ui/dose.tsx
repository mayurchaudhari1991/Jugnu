import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { act } from '@/core/engine';
import { isBeforeStart } from '@/core/schedule';
import { useStore } from '@/core/store';
import { fmtTime, fmtTimeFull } from '@/core/time';
import type { Dose, Item } from '@/core/types';
import { Icon, ItemGlyph } from './icons';
import { Btn, Sheet } from './kit';
import { C, itemTint } from './theme';
import { SnoozeChoices } from './pickers';
import { Txt } from './Txt';

export function ItemTile({ item, size = 40, radius = 12 }: { item: Pick<Item, 'icon' | 'color'>; size?: number; radius?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: itemTint(item.color), alignItems: 'center', justifyContent: 'center' }}>
      <ItemGlyph icon={item.icon} color={item.color} size={Math.round(size * 0.55)} />
    </View>
  );
}

export function doseSub(d: Dose) {
  return `${d.item.number ? `#${d.item.number} · ` : ''}${d.item.detail}`;
}

function statusLine(d: Dose, beforeStart = false): { text: string; color: string; bg?: string } | null {
  if (beforeStart) return { text: 'Before Jugnu started', color: C.ink3 };
  if (d.status === 'done') return { text: `${d.item.doneLabel || 'Done'} at ${fmtTimeFull(d.actedAt ?? d.at)}`, color: C.doneText };
  if (d.status === 'skipped') return { text: `Skipped at ${fmtTimeFull(d.actedAt ?? d.at)}`, color: C.ink2 };
  if (d.status === 'missed') return { text: 'Missed', color: C.danger };
  const shift = Math.round((d.at - d.planned) / 60000);
  if (d.snoozed) return { text: `Snoozed ${d.snoozes}× · now ${fmtTimeFull(d.at)}`, color: '#3F4659', bg: C.chip };
  if (shift > 0) return { text: `Moved +${shift} min · keeps the gap`, color: '#3F4659', bg: C.chip };
  if (d.fixed) return { text: 'Own time', color: C.ink2 };
  return null;
}

export function DoseRow({ d, onOpen }: { d: Dose; onOpen: (d: Dose) => void }) {
  const done = d.status === 'done';
  const t = fmtTime(done || d.status !== 'pending' ? d.planned : d.at);
  const settings = useStore((s) => s.settings);
  const before = isBeforeStart(d, settings);
  const line = statusLine(d, before);
  const dim = d.status === 'skipped' || d.status === 'missed' || before;
  const toggle = () => {
    Haptics.impactAsync(done ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    // Ticking a missed or skipped one counts it as done late; only a done one unticks.
    act(d, done ? 'undo' : 'done');
  };
  return (
    <Pressable
      onPress={() => onOpen(d)}
      accessibilityRole="button"
      accessibilityLabel={`${d.item.title}, ${t.time} ${t.ap}. Options`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        backgroundColor: C.card,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: C.line,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ width: 50 }}>
        <Txt display size={17} weight="bold" lh={1.05} maxFontSizeMultiplier={1.3} style={{ opacity: dim ? 0.6 : 1 }}>
          {t.time}
        </Txt>
        <Txt size={11} weight="bold" color={C.ink2}>
          {t.ap}
        </Txt>
      </View>
      <View style={{ opacity: dim ? 0.55 : 1 }}>
        <ItemTile item={d.item} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt size={15} weight="bold" lh={1.25} style={dim ? { textDecorationLine: d.status === 'skipped' ? 'line-through' : 'none', color: C.ink2 } : undefined}>
          {d.item.title}
        </Txt>
        <Txt size={12.5} color={C.ink2} lh={1.3}>
          {doseSub(d)}
        </Txt>
        {line ? (
          <View style={line.bg ? { alignSelf: 'flex-start', backgroundColor: line.bg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, marginTop: 2 } : undefined}>
            <Txt size={11.5} weight="bold" color={line.color}>
              {line.text}
            </Txt>
          </View>
        ) : null}
      </View>
      <Pressable
        onPress={toggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={done ? `Untick ${d.item.title}` : `Mark ${d.item.title} as ${(d.item.doneLabel || 'done').toLowerCase()}`}
        hitSlop={8}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: done ? C.done : C.card,
          borderWidth: done ? 0 : 2,
          borderColor: d.status === 'missed' ? '#E8A39A' : '#BFC4D3',
        }}
      >
        {done ? <Icon name="check" size={22} color="#FFFFFF" stroke={3} /> : null}
      </Pressable>
    </Pressable>
  );
}

/** Actions for one dose: done, skip, snooze, undo, edit. */
export function DoseSheet({ d, onClose, snoozeMin }: { d: Dose | null; onClose: () => void; snoozeMin: number }) {
  if (!d) return null;
  const pending = d.status === 'pending';
  const run = (a: Parameters<typeof act>[1]) => {
    act(d, a);
    onClose();
  };
  return (
    <Sheet visible={!!d} onClose={onClose} title={d.item.title}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <ItemTile item={d.item} size={52} radius={15} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt size={15} weight="bold">
            {doseSub(d)}
          </Txt>
          <Txt size={13} color={C.ink2}>
            {d.routine.name} · {fmtTimeFull(d.at)}
          </Txt>
          {d.item.note ? (
            <Txt size={13} color={C.ink2} style={{ marginTop: 4 }}>
              {d.item.note}
            </Txt>
          ) : null}
        </View>
      </View>
      {pending ? (
        <View style={{ gap: 10 }}>
          <Btn label={d.item.doneLabel || 'Done'} icon="check" onPress={() => run('done')} tall />
          <Btn label="Skip this time" kind="secondary" icon="skip" onPress={() => run('skip')} />
          <SnoozeChoices
            defaultMin={snoozeMin}
            onPick={(m) => {
              act(d, 'snooze', Date.now(), m);
              onClose();
            }}
          />
        </View>
      ) : (
        <Btn label="Undo — mark as not done" kind="secondary" icon="repeat" onPress={() => run('undo')} />
      )}
      <Btn
        label="Edit this item"
        kind="ghost"
        icon="edit"
        onPress={() => {
          onClose();
          router.push({ pathname: '/item/[id]', params: { id: d.item.id } });
        }}
      />
    </Sheet>
  );
}
