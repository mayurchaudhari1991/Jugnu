import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';
import { useStore } from '@/core/store';
import { uid } from '@/core/time';
import type { Item } from '@/core/types';
import { ItemTile } from '@/ui/dose';
import { ItemGlyph, RoutineGlyph } from '@/ui/icons';
import { Btn, Card, Chip, ColorDots, Field, Label, Screen } from '@/ui/kit';
import { C, ITEM_ICONS, routineColor } from '@/ui/theme';
import { TopBar } from '@/ui/TopBar';
import { Txt } from '@/ui/Txt';

const MED_ICONS = new Set(['pills', 'tablet', 'capsule', 'drops', 'hair']);

export default function ItemEditor() {
  const { id } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const item = useStore((s) => s.items[id]);
  const routines = useStore((s) => s.routines);

  if (!item) {
    return (
      <Screen>
        <TopBar title="Not found" />
        <Txt color={C.ink2}>This item was deleted.</Txt>
      </Screen>
    );
  }

  const save = (patch: Partial<Item>) => useStore.getState().saveItem({ ...item, ...patch });
  const inRoutine = (rid: string) => routines.find((r) => r.id === rid)?.slots.some((s) => s.itemId === item.id) ?? false;
  const usedIn = routines.filter((r) => r.slots.some((s) => s.itemId === item.id));
  const isReminderItem = usedIn.length > 0 && usedIn.every((r) => r.kind === 'reminder');

  const toggleRoutine = (rid: string) => {
    const r = useStore.getState().routines.find((x) => x.id === rid);
    if (!r) return;
    const slots = inRoutine(rid) ? r.slots.filter((s) => s.itemId !== item.id) : [...r.slots, { id: uid('s'), itemId: item.id, fixedMin: null }];
    useStore.getState().saveRoutine({ ...r, slots });
  };

  const remove = () => {
    Alert.alert(`Delete "${item.title}"?`, 'It is removed from every routine and stops ringing.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (isReminderItem) usedIn.forEach((r) => useStore.getState().deleteRoutine(r.id));
          useStore.getState().deleteItem(item.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen bottomPad={40}>
      <TopBar title={isReminderItem ? 'Reminder details' : 'Item'} />

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <ItemTile item={item} size={56} radius={16} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt size={17} weight="heavy" numberOfLines={2}>
            {item.title || 'Untitled'}
          </Txt>
          <Txt size={13.5} color={C.ink2} numberOfLines={2}>
            {item.number ? `#${item.number} · ` : ''}
            {item.detail || 'No details yet'}
          </Txt>
        </View>
      </Card>

      <Card style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ width: 84 }}>
            <Field label="No." value={item.number} onChangeText={(number) => save({ number })} placeholder="–" keyboardType="default" maxLength={4} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Name" value={item.title} onChangeText={(title) => save({ title })} placeholder="Vitamin D" />
          </View>
        </View>
        <Field
          label={MED_ICONS.has(item.icon) ? 'Dose and how to take it' : 'What to do'}
          value={item.detail}
          onChangeText={(detail) => save({ detail })}
          placeholder={MED_ICONS.has(item.icon) ? '1 tablet with warm water' : '3 sets of 12 squats'}
        />
        <Field label="Note (shown on the alarm)" value={item.note} onChangeText={(note) => save({ note })} placeholder="Anything to remember" multiline />
      </Card>

      <Card style={{ gap: 10 }}>
        <Label>Icon</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {ITEM_ICONS.map((ic) => {
            const on = item.icon === ic.key;
            return (
              <Pressable
                key={ic.key}
                onPress={() => save({ icon: ic.key, doneLabel: MED_ICONS.has(ic.key) ? 'Taken' : item.doneLabel === 'Taken' ? 'Done' : item.doneLabel })}
                accessibilityRole="button"
                accessibilityLabel={ic.label}
                accessibilityState={{ selected: on }}
                style={{ width: 70, alignItems: 'center', gap: 4, paddingVertical: 8, borderRadius: 14, borderWidth: 2, borderColor: on ? C.ink : C.line, backgroundColor: on ? C.chip : C.card }}
              >
                <ItemGlyph icon={ic.key} color={on ? item.color : C.ink2} size={22} />
                <Txt size={11.5} weight="bold" color={on ? C.ink : C.ink2}>
                  {ic.label}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card style={{ gap: 10 }}>
        <Label>Colour</Label>
        <ColorDots value={item.color} onChange={(color) => save({ color })} />
      </Card>

      <Card style={{ gap: 10 }}>
        <Label>Main button on the alarm</Label>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {['Taken', 'Done'].map((l) => (
            <Chip key={l} label={l} on={item.doneLabel === l} onPress={() => save({ doneLabel: l })} />
          ))}
        </View>
      </Card>

      {!isReminderItem ? (
        <Card style={{ gap: 10 }}>
          <Label>Rings in these routines</Label>
          {routines
            .filter((r) => r.kind === 'routine')
            .sort((a, b) => a.startMin - b.startMin)
            .map((r) => {
              const on = inRoutine(r.id);
              const rc = routineColor(r.color);
              return (
                <Pressable
                  key={r.id}
                  onPress={() => toggleRoutine(r.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={r.name}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 }}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: rc.tint, alignItems: 'center', justifyContent: 'center' }}>
                    <RoutineGlyph icon={r.icon} color={rc.solid} size={20} />
                  </View>
                  <Txt size={15} weight="bold" style={{ flex: 1 }}>
                    {r.name}
                  </Txt>
                  <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: on ? C.done : '#BFC4D3', backgroundColor: on ? C.done : C.card, alignItems: 'center', justifyContent: 'center' }}>
                    {on ? <Txt size={14} weight="heavy" color="#FFFFFF" lh={1}>✓</Txt> : null}
                  </View>
                </Pressable>
              );
            })}
          <Txt size={12.5} color={C.ink2}>
            {usedIn.length === 0 ? 'Not in any routine, so it never rings.' : `${usedIn.length} time${usedIn.length === 1 ? '' : 's'} a day.`}
          </Txt>
        </Card>
      ) : null}

      <Btn label={isReminderItem ? 'Delete reminder' : 'Delete item'} kind="danger" icon="trash" onPress={remove} />
    </Screen>
  );
}
