import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { newItem, ordinal, plannedTimes, repeatText } from '@/core/routines';
import { useStore } from '@/core/store';
import { fmtDateShort, fmtMinFull, fmtTime, minutesOf, todayKey, uid, WEEKDAYS_LETTER, WEEKDAYS_SHORT } from '@/core/time';
import type { Repeat, Routine, Slot } from '@/core/types';
import { ItemTile } from '@/ui/dose';
import { Icon, RoutineGlyph } from '@/ui/icons';
import { Btn, Card, Chip, DatePicker, Divider, Field, IconBtn, Label, Screen, Sheet, Stepper, TimeField, Toggle } from '@/ui/kit';
import { C, ROUTINE_COLORS, ROUTINE_ICONS, routineColor } from '@/ui/theme';
import { MinutesStepper, SoundPicker } from '@/ui/pickers';
import { TopBar } from '@/ui/TopBar';
import { Txt } from '@/ui/Txt';

export default function RoutineEditor() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const routine = useStore((s) => s.routines.find((r) => r.id === id));
  const items = useStore((s) => s.items);
  const defaultSound = useStore((s) => s.settings.sound);
  const [slotSheet, setSlotSheet] = useState<Slot | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  // A brand-new routine left empty is thrown away when you leave.
  useEffect(() => {
    return () => {
      if (!fresh) return;
      const st = useStore.getState();
      const r = st.routines.find((x) => x.id === id);
      if (r && r.kind === 'routine' && r.slots.length === 0 && r.name === 'New routine') st.deleteRoutine(r.id);
    };
  }, [id, fresh]);

  if (!routine) {
    return (
      <Screen>
        <TopBar title="Not found" />
        <Txt color={C.ink2}>This routine was deleted.</Txt>
      </Screen>
    );
  }

  const isReminder = routine.kind === 'reminder';
  const rc = routineColor(routine.color);
  const save = (patch: Partial<Routine>) => useStore.getState().saveRoutine({ ...routine, ...patch });
  const times = plannedTimes(routine);
  const reminderItem = isReminder ? items[routine.slots[0]?.itemId] : null;

  const move = (i: number, dir: -1 | 1) => {
    const slots = [...routine.slots];
    const j = i + dir;
    if (j < 0 || j >= slots.length) return;
    [slots[i], slots[j]] = [slots[j], slots[i]];
    save({ slots });
  };

  const setRepeat = (repeat: Repeat) => save({ repeat });

  const remove = () => {
    Alert.alert(`Delete "${isReminder ? (reminderItem?.title ?? routine.name) : routine.name}"?`, 'Its alarms stop and it disappears from Today. History stays.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          useStore.getState().deleteRoutine(routine.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen bottomPad={40}>
        <TopBar title={isReminder ? 'Reminder' : 'Routine'} />

        {isReminder && reminderItem ? (
          <Card style={{ gap: 14 }}>
            <Field
              label="What should Jugnu remind you?"
              value={reminderItem.title}
              onChangeText={(title) => {
                useStore.getState().saveItem({ ...reminderItem, title });
                save({ name: title || 'Reminder' });
              }}
              placeholder="Pay electricity bill"
            />
            <Field
              label="Details (optional)"
              value={reminderItem.detail}
              onChangeText={(detail) => useStore.getState().saveItem({ ...reminderItem, detail })}
              placeholder="Amount, number to call, anything"
            />
            <Btn label="Icon, colour and more" kind="secondary" icon="edit" onPress={() => router.push({ pathname: '/item/[id]', params: { id: reminderItem.id } })} />
          </Card>
        ) : (
          <Card style={{ gap: 14 }}>
            <Field label="Name" value={routine.name} onChangeText={(name) => save({ name })} placeholder="Morning medicines" />
            <View style={{ gap: 8 }}>
              <Label>Icon</Label>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {ROUTINE_ICONS.map((ic) => {
                  const on = routine.icon === ic;
                  return (
                    <Pressable
                      key={ic}
                      onPress={() => save({ icon: ic })}
                      accessibilityRole="button"
                      accessibilityLabel={`Icon ${ic}`}
                      accessibilityState={{ selected: on }}
                      style={{ width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: on ? rc.solid : C.line, backgroundColor: on ? rc.tint : C.card }}
                    >
                      <RoutineGlyph icon={ic} color={on ? rc.solid : C.ink2} size={21} />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Card>
        )}

        <Card style={{ gap: 10 }}>
          <Label>Colour</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {ROUTINE_COLORS.map((c) => {
              const on = routine.color === c.key;
              return (
                <Pressable
                  key={c.key}
                  onPress={() => save({ color: c.key })}
                  accessibilityRole="button"
                  accessibilityLabel={c.name}
                  accessibilityState={{ selected: on }}
                  style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: on ? C.ink : 'transparent', alignItems: 'center', justifyContent: 'center' }}
                >
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.solid }} />
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 4 }}>
            <View style={{ flex: 1 }}>
              <Txt size={15} weight="bold">
                {isReminder ? 'Time' : 'Starts at'}
              </Txt>
              {!isReminder ? (
                <Txt size={12.5} color={C.ink2}>
                  The first item rings at this time
                </Txt>
              ) : null}
            </View>
            <TimeField label={isReminder ? 'Reminder time' : 'Start time'} min={routine.startMin} onChange={(startMin) => save({ startMin })} />
          </View>
          {!isReminder ? (
            <>
              <Divider />
              <MinutesStepper
                label="Gap between items"
                help="At least this long between two alarms. Tap to type."
                value={routine.gapMin}
                min={0}
                max={240}
                quick={[0, 2, 5, 10, 15, 20, 30, 60]}
                onChange={(gapMin) => save({ gapMin })}
              />
            </>
          ) : null}
        </Card>

        <Card style={{ gap: 12 }}>
          <Label>Repeat · {repeatText(routine.repeat)}</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label="Every day" on={routine.repeat.type === 'daily'} onPress={() => setRepeat({ type: 'daily' })} />
            <Chip
              label="Some days"
              on={routine.repeat.type === 'weekly'}
              onPress={() => setRepeat({ type: 'weekly', days: routine.repeat.type === 'weekly' ? routine.repeat.days : [1, 2, 3, 4, 5] })}
            />
            {isReminder ? (
              <>
                <Chip label="Monthly" on={routine.repeat.type === 'monthly'} onPress={() => setRepeat({ type: 'monthly', day: new Date().getDate() })} />
                <Chip label="Yearly" on={routine.repeat.type === 'yearly'} onPress={() => setRepeat({ type: 'yearly', month: new Date().getMonth() + 1, day: new Date().getDate() })} />
                <Chip label="Once" on={routine.repeat.type === 'once'} onPress={() => setRepeat({ type: 'once', date: todayKey() })} />
              </>
            ) : null}
          </View>

          {routine.repeat.type === 'weekly' ? (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {WEEKDAYS_LETTER.map((l, i) => {
                const days = (routine.repeat as { days: number[] }).days;
                const on = days.includes(i);
                return (
                  <Pressable
                    key={i}
                    onPress={() => setRepeat({ type: 'weekly', days: on ? days.filter((d) => d !== i) : [...days, i].sort() })}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={WEEKDAYS_SHORT[i]}
                    style={{ flex: 1, aspectRatio: 1, maxWidth: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? rc.solid : C.card, borderWidth: 1, borderColor: on ? rc.solid : '#D5D9E3' }}
                  >
                    <Txt size={14} weight="heavy" color={on ? '#FFFFFF' : C.ink}>
                      {l}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {routine.repeat.type === 'monthly' ? (
            <Stepper
              label="Day of the month"
              help="31st rings on the last day of short months"
              value={ordinal(routine.repeat.day)}
              onDec={() => setRepeat({ type: 'monthly', day: Math.max(1, (routine.repeat as { day: number }).day - 1) })}
              onInc={() => setRepeat({ type: 'monthly', day: Math.min(31, (routine.repeat as { day: number }).day + 1) })}
            />
          ) : null}

          {routine.repeat.type === 'yearly' || routine.repeat.type === 'once' ? (
            <>
              <Btn
                label={
                  routine.repeat.type === 'once'
                    ? fmtDateShort(routine.repeat.date)
                    : `${routine.repeat.day} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][routine.repeat.month - 1]}`
                }
                kind="secondary"
                icon="calendar"
                onPress={() => setDateOpen(true)}
              />
              <DatePicker
                visible={dateOpen}
                title="Pick a date"
                value={
                  routine.repeat.type === 'once'
                    ? routine.repeat.date
                    : `${new Date().getFullYear()}-${String(routine.repeat.month).padStart(2, '0')}-${String(routine.repeat.day).padStart(2, '0')}`
                }
                onClose={() => setDateOpen(false)}
                onDone={(key) => {
                  setDateOpen(false);
                  const [, m, d] = key.split('-').map(Number);
                  setRepeat(routine.repeat.type === 'once' ? { type: 'once', date: key } : { type: 'yearly', month: m, day: d });
                }}
              />
            </>
          ) : null}
        </Card>

        {!isReminder ? (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Txt display size={21} weight="bold">
                Items
              </Txt>
              <Txt size={13} weight="semibold" color={C.ink2}>
                Ring in this order
              </Txt>
            </View>
            {routine.slots.map((slot, i) => {
              const item = items[slot.itemId];
              if (!item) return null;
              const t = times[slot.id] ? fmtTime(times[slot.id]) : { time: '–', ap: '' };
              return (
                <View key={slot.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingLeft: 12, backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line }}>
                  <Pressable onPress={() => setSlotSheet(slot)} accessibilityRole="button" accessibilityLabel={`${item.title}, ${t.time} ${t.ap}. Options`} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>
                    <View style={{ width: 50 }}>
                      <Txt display size={16} weight="bold" lh={1.05} maxFontSizeMultiplier={1.3}>
                        {t.time}
                      </Txt>
                      <Txt size={11} weight="bold" color={slot.fixedMin != null ? rc.text : C.ink2}>
                        {slot.fixedMin != null ? `${t.ap} · own` : t.ap}
                      </Txt>
                    </View>
                    <ItemTile item={item} size={38} radius={11} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt size={14.5} weight="bold" numberOfLines={2} lh={1.25}>
                        {item.title}
                      </Txt>
                      <Txt size={12} color={C.ink2} numberOfLines={1}>
                        {item.number ? `#${item.number} · ` : ''}
                        {item.detail}
                      </Txt>
                    </View>
                  </Pressable>
                  <View style={{ gap: 4 }}>
                    <IconBtn name="up" label={`Move ${item.title} up`} onPress={() => move(i, -1)} size={34} bg={C.chip} border={C.chip} />
                    <IconBtn name="down" label={`Move ${item.title} down`} onPress={() => move(i, 1)} size={34} bg={C.chip} border={C.chip} />
                  </View>
                </View>
              );
            })}
            <Btn label="Add item" icon="plus" kind="secondary" onPress={() => setAddOpen(true)} />
          </View>
        ) : null}

        <Card pad={6} style={{ paddingHorizontal: 16 }}>
          <SoundPicker label="Sound for this one" value={routine.sound ?? null} fallback={defaultSound} onChange={(sound) => save({ sound })} />
        </Card>

        <Card pad={6} style={{ paddingHorizontal: 16 }}>
          <Toggle label={routine.active ? 'On' : 'Paused'} help={routine.active ? 'Rings as planned' : 'No alarms until you switch it back on'} on={routine.active} onChange={(active) => save({ active })} />
        </Card>

        <Btn label={isReminder ? 'Delete reminder' : 'Delete routine'} kind="danger" icon="trash" onPress={remove} />
      </Screen>

      <SlotSheet routine={routine} slot={slotSheet} onClose={() => setSlotSheet(null)} plannedMs={slotSheet ? times[slotSheet.id] : undefined} />

      <Sheet visible={addOpen} onClose={() => setAddOpen(false)} title="Add to this routine">
        <Btn
          label="Create a new item"
          icon="plus"
          onPress={() => {
            const item = newItem();
            useStore.getState().saveItem(item);
            save({ slots: [...routine.slots, { id: uid('s'), itemId: item.id, fixedMin: null }] });
            setAddOpen(false);
            router.push({ pathname: '/item/[id]', params: { id: item.id, fresh: '1' } });
          }}
          tall
        />
        <ExistingItems
          exclude={routine.slots.map((s) => s.itemId)}
          onPick={(itemId) => {
            save({ slots: [...routine.slots, { id: uid('s'), itemId, fixedMin: null }] });
            setAddOpen(false);
          }}
        />
      </Sheet>
    </View>
  );
}

function ExistingItems({ exclude, onPick }: { exclude: string[]; onPick: (id: string) => void }) {
  const items = useStore((s) => s.items);
  const routines = useStore((s) => s.routines);
  const used = new Set(routines.filter((r) => r.kind === 'routine').flatMap((r) => r.slots.map((s) => s.itemId)));
  const list = Object.values(items).filter((i) => !exclude.includes(i.id) && used.has(i.id));
  if (list.length === 0) return null;
  return (
    <View style={{ gap: 8 }}>
      <Label>Or reuse one you already have</Label>
      <View style={{ gap: 8, maxHeight: 360 }}>
        {list.slice(0, 12).map((item) => (
          <Pressable key={item.id} onPress={() => onPick(item.id)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.line }}>
            <ItemTile item={item} size={36} radius={10} />
            <Txt size={14.5} weight="bold" style={{ flex: 1 }} numberOfLines={1}>
              {item.title}
            </Txt>
            <Icon name="plus" size={18} color={C.ink2} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function SlotSheet({ routine, slot, onClose, plannedMs }: { routine: Routine; slot: Slot | null; onClose: () => void; plannedMs?: number }) {
  const item = useStore((s) => (slot ? s.items[slot.itemId] : undefined));
  if (!slot || !item) return null;
  const update = (patch: Partial<Slot>) =>
    useStore.getState().saveRoutine({ ...routine, slots: routine.slots.map((s) => (s.id === slot.id ? { ...s, ...patch } : s)) });
  const own = slot.fixedMin != null;
  const current = routine.slots.find((s) => s.id === slot.id) ?? slot;
  return (
    <Sheet visible onClose={onClose} title={item.title}>
      <Card pad={6} style={{ paddingHorizontal: 16 }}>
        <Toggle
          label="Its own time"
          help={own ? 'Rings at a fixed time, outside the gap chain' : `Rings in the chain, ${routine.gapMin} min after the one before`}
          on={current.fixedMin != null}
          onChange={(v) => update({ fixedMin: v ? (plannedMs ? minutesOf(plannedMs) : routine.startMin) : null })}
        />
        {current.fixedMin != null ? (
          <View style={{ paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Txt size={14} color={C.ink2}>
              Rings at {fmtMinFull(current.fixedMin)}
            </Txt>
            <TimeField label={`${item.title} time`} min={current.fixedMin} onChange={(m) => update({ fixedMin: m })} />
          </View>
        ) : null}
      </Card>
      <Btn
        label="Edit item (name, dose, icon)"
        kind="secondary"
        icon="edit"
        onPress={() => {
          onClose();
          router.push({ pathname: '/item/[id]', params: { id: item.id } });
        }}
      />
      <Btn
        label="Remove from this routine"
        kind="danger"
        icon="trash"
        onPress={() => {
          useStore.getState().saveRoutine({ ...routine, slots: routine.slots.filter((s) => s.id !== slot.id) });
          onClose();
        }}
      />
    </Sheet>
  );
}
