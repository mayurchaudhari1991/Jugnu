import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type RefreshControlProps,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fmtMin, MONTHS, pad, parseDateKey, dateKey } from '@/core/time';
import { Icon, type UIIconName } from './icons';
import { C, F, ITEM_COLORS, MAX_W } from './theme';
import { Txt } from './Txt';

/** Scrolling page with safe-area padding and a readable max width on big screens. */
export function Screen({
  children,
  scroll = true,
  bottomPad = 24,
  bg = C.bg,
  refresh,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  bottomPad?: number;
  bg?: string;
  /** Pull-to-refresh control. */
  refresh?: React.ReactElement<RefreshControlProps>;
}) {
  const insets = useSafeAreaInsets();
  const inner = (
    <View style={{ width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 20, gap: 18 }}>{children}</View>
  );
  if (!scroll) return <View style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top + 12 }}>{inner}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: bottomPad }}
        keyboardShouldPersistTaps="handled"
        refreshControl={refresh}
      >
        {inner}
      </ScrollView>
      {/* Keeps scrolled content from running under the status bar clock. */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: bg }} />
    </View>
  );
}

export function Card({ children, style, pad = 16 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; pad?: number }) {
  return <View style={[s.card, { padding: pad }, style]}>{children}</View>;
}

type BtnKind = 'primary' | 'secondary' | 'ghost' | 'danger' | 'light' | 'onDark';

export function Btn({
  label,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  style,
  tall,
  a11y,
}: {
  label: string;
  onPress?: () => void;
  kind?: BtnKind;
  icon?: UIIconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  tall?: boolean;
  a11y?: string;
}) {
  const bg = { primary: C.ink, secondary: C.card, ghost: 'transparent', danger: C.card, light: '#FFFFFF', onDark: 'transparent' }[kind];
  const fg = { primary: '#FFFFFF', secondary: C.ink, ghost: C.ink, danger: C.danger, light: C.ink, onDark: '#FFFFFF' }[kind];
  const border = { primary: C.ink, secondary: '#D5D9E3', ghost: 'transparent', danger: '#F2C9C0', light: '#FFFFFF', onDark: '#3A4466' }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, borderColor: border, minHeight: tall ? 58 : 48, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={18} color={fg} stroke={2.4} /> : null}
      <Txt size={tall ? 17 : 15} weight="heavy" color={fg}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function IconBtn({
  name,
  onPress,
  label,
  bg = C.card,
  color = C.ink,
  border = C.line,
  size = 44,
}: {
  name: UIIconName;
  onPress?: () => void;
  label: string;
  bg?: string;
  color?: string;
  border?: string;
  size?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: 14, backgroundColor: bg, borderWidth: 1, borderColor: border, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Icon name={name} size={20} color={color} />
    </Pressable>
  );
}

export function Chip({ label, on, onPress, color }: { label: string; on: boolean; onPress: () => void; color?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[s.chip, on ? { backgroundColor: color ?? C.ink, borderColor: color ?? C.ink } : null]}
    >
      <Txt size={13.5} weight="bold" color={on ? '#FFFFFF' : C.ink}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <Txt size={13} weight="bold" color={C.ink2}>
      {children}
    </Txt>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
      <Txt display size={21} weight="bold" style={{ flexShrink: 1 }}>
        {children}
      </Txt>
      {right}
    </View>
  );
}

export function Field({ label, ...input }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Label>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={C.ink3}
        {...input}
        style={[s.input, input.multiline ? { minHeight: 80, paddingTop: 12, textAlignVertical: 'top' } : null, input.style]}
      />
    </View>
  );
}

export function Stepper({
  label,
  help,
  value,
  onDec,
  onInc,
  onPressValue,
}: {
  label: string;
  help?: string;
  value: string;
  onDec: () => void;
  onInc: () => void;
  /** Tapping the number opens a keypad to type any value. */
  onPressValue?: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt size={15} weight="bold">
          {label}
        </Txt>
        {help ? (
          <Txt size={12.5} color={C.ink2}>
            {help}
          </Txt>
        ) : null}
      </View>
      <IconBtn name="minus" label={`Less ${label}`} onPress={onDec} bg={C.chip} border={C.chip} size={42} />
      {onPressValue ? (
        <Pressable
          onPress={onPressValue}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value}. Type a number`}
          style={{ minWidth: 72, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: '#C3C8D6', borderStyle: 'dashed' }}
        >
          <Txt display size={18} weight="bold" align="center" maxFontSizeMultiplier={1.3}>
            {value}
          </Txt>
        </Pressable>
      ) : (
        <Txt display size={18} weight="bold" align="center" style={{ minWidth: 64 }} maxFontSizeMultiplier={1.3}>
          {value}
        </Txt>
      )}
      <IconBtn name="plus" label={`More ${label}`} onPress={onInc} bg={C.chip} border={C.chip} size={42} />
    </View>
  );
}

/** A switch row. The whole row is the control. */
export function Toggle({ label, help, on, onChange }: { label: string; help?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      onPress={() => onChange(!on)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: 48 }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt size={15} weight="bold">
          {label}
        </Txt>
        {help ? (
          <Txt size={12.5} color={C.ink2}>
            {help}
          </Txt>
        ) : null}
      </View>
      <View style={[s.track, { backgroundColor: on ? C.done : '#C3C8D6', alignItems: on ? 'flex-end' : 'flex-start' }]}>
        <View style={s.knob} />
      </View>
    </Pressable>
  );
}

export function ColorDots({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {ITEM_COLORS.map((c) => {
        const on = c.c.toLowerCase() === value.toLowerCase();
        return (
          <Pressable
            key={c.c}
            accessibilityRole="button"
            accessibilityLabel={c.name}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(c.c)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              borderWidth: 2,
              borderColor: on ? C.ink : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.c }} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** Bottom sheet built on Modal. */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={{ width: '100%', maxWidth: MAX_W, alignSelf: 'center', gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Txt display size={21} weight="bold">
              {title}
            </Txt>
            <IconBtn name="x" label="Close" onPress={onClose} />
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

/** Shows a time; tapping opens a picker with hour and minute grids. */
export function TimeField({ label, min, onChange }: { label: string; min: number; onChange: (m: number) => void }) {
  const [open, setOpen] = useState(false);
  const t = fmtMin(min);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${t.time} ${t.ap}. Change`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [s.timeField, { opacity: pressed ? 0.8 : 1 }]}
      >
        <Icon name="clock" size={18} color={C.ink2} />
        <Txt display size={20} weight="bold">
          {t.time}
        </Txt>
        <Txt size={13} weight="bold" color={C.ink2}>
          {t.ap}
        </Txt>
      </Pressable>
      <TimePicker visible={open} title={label} min={min} onClose={() => setOpen(false)} onDone={(m) => { onChange(m); setOpen(false); }} />
    </>
  );
}

export function TimePicker({
  visible,
  title,
  min,
  onClose,
  onDone,
}: {
  visible: boolean;
  title: string;
  min: number;
  onClose: () => void;
  onDone: (m: number) => void;
}) {
  const [h24, setH24] = useState(Math.floor(min / 60));
  const [m, setM] = useState(min % 60);
  const [key, setKey] = useState(min);
  if (visible && key !== min) {
    setKey(min);
    setH24(Math.floor(min / 60));
    setM(min % 60);
  }
  const pm = h24 >= 12;
  const h12 = h24 % 12 || 12;
  const setHour = (h: number) => setH24((h % 12) + (pm ? 12 : 0));
  const t = fmtMin(h24 * 60 + m);
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <IconBtn name="minus" label="One minute earlier" onPress={() => { const v = (h24 * 60 + m + 1439) % 1440; setH24(Math.floor(v / 60)); setM(v % 60); }} />
        <Txt display size={44} weight="bold" maxFontSizeMultiplier={1.2}>
          {t.time}
        </Txt>
        <Txt size={18} weight="heavy" color={C.ink2}>
          {t.ap}
        </Txt>
        <IconBtn name="plus" label="One minute later" onPress={() => { const v = (h24 * 60 + m + 1) % 1440; setH24(Math.floor(v / 60)); setM(v % 60); }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label="AM" on={!pm} onPress={() => pm && setH24(h24 - 12)} />
        <Chip label="PM" on={pm} onPress={() => !pm && setH24(h24 + 12)} />
      </View>
      <Label>Hour</Label>
      <View style={s.grid}>
        {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => (
          <GridCell key={h} label={`${h}`} on={h12 === h} onPress={() => setHour(h)} />
        ))}
      </View>
      <Label>Minute</Label>
      <View style={s.grid}>
        {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((mm) => (
          <GridCell key={mm} label={`:${pad(mm)}`} on={m === mm} onPress={() => setM(mm)} />
        ))}
      </View>
      <Btn label={`Set ${t.time} ${t.ap}`} onPress={() => onDone(h24 * 60 + m)} tall />
    </Sheet>
  );
}

function GridCell({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[s.cell, on ? { backgroundColor: C.ink, borderColor: C.ink } : null]}
    >
      <Txt size={15} weight="bold" color={on ? '#FFFFFF' : C.ink}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** A month calendar in a sheet. */
export function DatePicker({
  visible,
  title,
  value,
  onClose,
  onDone,
}: {
  visible: boolean;
  title: string;
  value: string;
  onClose: () => void;
  onDone: (key: string) => void;
}) {
  const v = parseDateKey(value);
  const [month, setMonth] = useState(new Date(v.getFullYear(), v.getMonth(), 1));
  const first = month.getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconBtn name="chevL" label="Previous month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} />
        <Txt size={17} weight="heavy">
          {MONTHS[month.getMonth()]} {month.getFullYear()}
        </Txt>
        <IconBtn name="chevR" label="Next month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <View key={`h${i}`} style={s.calCell}>
            <Txt size={12} weight="bold" color={C.ink2}>
              {d}
            </Txt>
          </View>
        ))}
        {cells.map((d, i) => {
          if (d == null) return <View key={`e${i}`} style={s.calCell} />;
          const key = dateKey(new Date(month.getFullYear(), month.getMonth(), d));
          const on = key === value;
          return (
            <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onDone(key)} style={s.calCell}>
              <View style={[s.calDay, on ? { backgroundColor: C.ink } : null]}>
                <Txt size={15} weight="bold" color={on ? '#FFFFFF' : C.ink}>
                  {d}
                </Txt>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: C.line2 }} />;
}

export function Banner({ icon = 'alert', text, action, onPress }: { icon?: UIIconName; text: string; action: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={s.banner}>
      <Icon name={icon} size={20} color={C.warnText} />
      <Txt size={13.5} weight="semibold" color={C.warnText} style={{ flex: 1 }}>
        {text}
      </Txt>
      <Txt size={13.5} weight="heavy" color={C.warnText}>
        {action}
      </Txt>
    </Pressable>
  );
}

export const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, borderWidth: 1, paddingHorizontal: 18 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: '#D5D9E3', backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  input: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D5D9E3',
    backgroundColor: C.card,
    paddingHorizontal: 14,
    fontFamily: F.semibold,
    fontSize: 16,
    color: C.ink,
  },
  track: { width: 48, height: 30, borderRadius: 15, padding: 3, justifyContent: 'center' },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF' },
  scrim: { flex: 1, backgroundColor: 'rgba(15,26,60,0.45)' },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 20 },
  timeField: { flexDirection: 'row', alignItems: 'baseline', gap: 6, minHeight: 50, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: '#D5D9E3', backgroundColor: C.card, alignSelf: 'flex-start', paddingTop: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '22%', flexGrow: 1, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#D5D9E3', backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  calCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  calDay: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, backgroundColor: C.warnTint },
});
