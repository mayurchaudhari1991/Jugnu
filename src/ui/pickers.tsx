import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import JugnuAlarm from '../../modules/jugnu-alarm';
import type { Sound } from '@/core/types';
import { Icon, type UIIconName } from './icons';
import { Btn, Chip, Label, Sheet, Stepper } from './kit';
import { C, F } from './theme';
import { Txt } from './Txt';

/** Type any whole number, with quick picks. */
export function NumberSheet({
  visible,
  title,
  value,
  unit,
  min,
  max,
  quick,
  onClose,
  onDone,
}: {
  visible: boolean;
  title: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  quick: number[];
  onClose: () => void;
  onDone: (n: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (visible) setText(String(value));
  }, [visible, value]);
  const n = Number(text);
  const ok = text !== '' && Number.isFinite(n) && n >= min && n <= max;
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 10 }}>
        <TextInput
          value={text}
          onChangeText={(t) => setText(t.replace(/[^0-9]/g, '').slice(0, 4))}
          keyboardType="number-pad"
          autoFocus
          selectTextOnFocus
          accessibilityLabel={`${title} in ${unit}`}
          style={{ minWidth: 120, fontFamily: F.display, fontSize: 52, color: C.ink, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: C.ink, paddingVertical: 4 }}
        />
        <Txt size={20} weight="heavy" color={C.ink2}>
          {unit}
        </Txt>
      </View>
      <Btn label={ok ? `Set ${n} ${unit}` : `Between ${min} and ${max}`} disabled={!ok} tall onPress={() => onDone(n)} />
      <Label>Quick picks</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {quick.map((q) => (
          <Chip key={q} label={`${q} ${unit}`} on={n === q} onPress={() => setText(String(q))} />
        ))}
      </View>
    </Sheet>
  );
}

/** A −/+ row for minutes that also opens a keypad when you tap the number. */
export function MinutesStepper({
  label,
  help,
  value,
  min,
  max,
  quick,
  onChange,
}: {
  label: string;
  help?: string;
  value: number;
  min: number;
  max: number;
  quick: number[];
  onChange: (n: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Stepper
        label={label}
        help={help}
        value={`${value} min`}
        onDec={() => onChange(Math.max(min, value - 1))}
        onInc={() => onChange(Math.min(max, value + 1))}
        onPressValue={() => setOpen(true)}
      />
      <NumberSheet
        visible={open}
        title={label}
        value={value}
        unit="min"
        min={min}
        max={max}
        quick={quick}
        onClose={() => setOpen(false)}
        onDone={(n) => {
          onChange(n);
          setOpen(false);
        }}
      />
    </>
  );
}

export const SNOOZE_QUICK = [2, 5, 10, 15, 20, 30, 45, 60];

/** Snooze lengths to pick from right now, plus any number. */
export function SnoozeChoices({ onPick, defaultMin, dark }: { onPick: (min: number) => void; defaultMin: number; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const opts = [...new Set([5, 10, 15, 30, defaultMin])].sort((a, b) => a - b);
  return (
    <View style={{ gap: 8 }}>
      <Txt size={13} weight="bold" color={dark ? C.onNight2 : C.ink2}>
        Snooze for
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {opts.map((m) => (
          <Pressable
            key={m}
            onPress={() => onPick(m)}
            accessibilityRole="button"
            accessibilityLabel={`Snooze ${m} minutes`}
            style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: dark ? '#3A4466' : '#D5D9E3', alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? 'transparent' : C.card }}
          >
            <Txt size={14} weight="bold" color={dark ? '#FFFFFF' : C.ink}>
              {m} min
            </Txt>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Snooze for a different number of minutes"
          style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: dark ? '#3A4466' : '#BFC4D3', alignItems: 'center', justifyContent: 'center' }}
        >
          <Txt size={14} weight="bold" color={dark ? '#FFFFFF' : C.ink}>
            Other…
          </Txt>
        </Pressable>
      </View>
      <NumberSheet
        visible={open}
        title="Snooze for"
        value={defaultMin}
        unit="min"
        min={1}
        max={720}
        quick={SNOOZE_QUICK}
        onClose={() => setOpen(false)}
        onDone={(n) => {
          setOpen(false);
          onPick(n);
        }}
      />
    </View>
  );
}

function SoundOption({ icon, title, help, on, onPress }: { icon: UIIconName; title: string; help?: string; on?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderRadius: 16,
        borderWidth: on ? 2 : 1,
        borderColor: on ? C.ink : C.line,
        backgroundColor: C.card,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={19} color={C.ink} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt size={15} weight="bold" numberOfLines={1}>
          {title}
        </Txt>
        {help ? (
          <Txt size={12.5} color={C.ink2} numberOfLines={1}>
            {help}
          </Txt>
        ) : null}
      </View>
      {on ? <Icon name="check" size={20} color={C.done} stroke={3} /> : null}
    </Pressable>
  );
}

/**
 * A row showing the current sound; tapping opens choices: the phone's own sounds,
 * any audio file, or (for a routine) the app-wide default.
 */
export function SoundPicker({
  label,
  value,
  onChange,
  fallback,
}: {
  label: string;
  /** null = use `fallback` (the app default). */
  value: Sound | null;
  onChange: (s: Sound | null) => void;
  fallback?: Sound;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const phoneDefault = JugnuAlarm?.defaultSoundTitle() ?? 'Phone default alarm';
  const effective = value ?? fallback ?? { uri: '', title: phoneDefault };
  const shownTitle = effective.uri === '' ? phoneDefault : effective.title;

  const close = () => {
    JugnuAlarm?.stopPreview();
    setPlaying(false);
    setOpen(false);
  };
  const pick = async (from: 'system' | 'file') => {
    if (!JugnuAlarm) return;
    JugnuAlarm.stopPreview();
    setPlaying(false);
    setBusy(true);
    try {
      const r = from === 'system' ? await JugnuAlarm.pickSystemSound(effective.uri) : await JugnuAlarm.pickFileSound();
      if (r) onChange(r);
    } finally {
      setBusy(false);
    }
  };
  const togglePreview = () => {
    if (playing) {
      JugnuAlarm?.stopPreview();
      setPlaying(false);
    } else {
      JugnuAlarm?.previewSound(effective.uri);
      setPlaying(true);
      setTimeout(() => setPlaying(false), 8000);
    }
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value == null && fallback ? 'same as default' : shownTitle}. Change`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 }}
      >
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="sound" size={19} color={C.ink} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt size={15} weight="bold">
            {label}
          </Txt>
          <Txt size={12.5} color={C.ink2} numberOfLines={1}>
            {value == null && fallback ? `Same as default · ${shownTitle}` : shownTitle}
          </Txt>
        </View>
        <Icon name="chevR" size={18} color={C.ink3} />
      </Pressable>

      <Sheet visible={open} onClose={close} title={label}>
        <View style={{ gap: 10 }}>
          {fallback ? (
            <SoundOption icon="repeat" title="Same as the default" help={fallback.uri === '' ? phoneDefault : fallback.title} on={value == null} onPress={() => onChange(null)} />
          ) : null}
          <SoundOption icon="bell" title="Phone's default alarm" help={phoneDefault} on={value != null && value.uri === ''} onPress={() => onChange({ uri: '', title: 'Phone default alarm' })} />
          <SoundOption
            icon="sound"
            title="Choose from phone sounds"
            help={value != null && value.uri !== '' ? `Now: ${value.title}` : 'Alarms, ringtones and notification tones'}
            on={false}
            onPress={() => pick('system')}
          />
          <SoundOption icon="book" title="Choose a song or audio file" help="Any music or recording on your phone" on={false} onPress={() => pick('file')} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Btn label={playing ? 'Stop' : `Play: ${shownTitle}`} kind="secondary" icon={playing ? 'pause' : 'sound'} onPress={togglePreview} style={{ flex: 1 }} disabled={busy} />
        </View>
        <Btn label={busy ? 'Opening…' : 'Done'} onPress={close} tall disabled={busy} />
      </Sheet>
    </>
  );
}
