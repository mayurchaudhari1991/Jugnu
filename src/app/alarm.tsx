import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, BackHandler, Easing, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import JugnuAlarm from '../../modules/jugnu-alarm';
import { act, findDose, nextInRoutine } from '@/core/engine';
import { useNow } from '@/core/hooks';
import { useRinging } from '@/core/launch';
import { useStore } from '@/core/store';
import { fmtDateLong, fmtTime, fmtTimeFull, todayKey } from '@/core/time';
import { ItemTile } from '@/ui/dose';
import { Icon } from '@/ui/icons';
import { C, MAX_W, routineColor } from '@/ui/theme';
import { SnoozeChoices } from '@/ui/pickers';
import { Txt } from '@/ui/Txt';

type Outcome = { title: string; body: string; color: string } | null;

export default function AlarmScreen() {
  const insets = useSafeAreaInsets();
  const alarm = useRinging((s) => s.alarm);
  const fromOutside = useRinging((s) => s.fromOutside);
  useStore((s) => s.rev);
  const settings = useStore((s) => s.settings);
  const now = useNow(1000);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [choosing, setChoosing] = useState(false);

  const dose = alarm ? findDose(alarm.id) : null;
  const isTest = !!alarm?.id.startsWith('test|');
  const rc = routineColor(dose?.routine.color ?? 'amber');
  const accent = rc.onNight;

  const close = () => {
    JugnuAlarm?.releaseLockScreen();
    useRinging.getState().set(null, false);
    if (router.canGoBack()) router.back();
    else router.replace('/');
    if (fromOutside) JugnuAlarm?.moveToBack();
  };

  // Answered elsewhere (a notification button or the Today list): nothing left to show.
  useEffect(() => {
    if (dose && dose.status !== 'pending' && !outcome) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dose?.status]);

  // Hardware back = leave it ringing in the notification, just close the page.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // Leaving without an answer stops the sound; the re-ring stays booked.
      if (alarm) JugnuAlarm?.silence(alarm.id);
      close();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromOutside, alarm]);

  const finish = (o: Outcome) => {
    setOutcome(o);
    setTimeout(close, 1600);
  };

  const answer = (a: 'done' | 'snooze' | 'skip', snoozeMin?: number) => {
    Haptics.notificationAsync(a === 'done' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {});
    if (!alarm) return close();
    if (!dose) {
      JugnuAlarm?.dismiss(alarm.id);
      return finish({ title: a === 'done' ? 'All good' : 'Stopped', body: 'The test alarm is off.', color: '#5BE0A8' });
    }
    const at = Date.now();
    act(dose, a, at, snoozeMin);
    const after = findDose(dose.alarmId);
    const nx = after ? nextInRoutine(after) : null;
    const nextText = nx ? `Next: ${nx.item.title} at ${fmtTimeFull(nx.at)}.` : 'That was the last one in this routine.';
    if (a === 'done') finish({ title: `${dose.item.doneLabel || 'Done'} at ${fmtTimeFull(at)}`, body: nextText, color: '#5BE0A8' });
    if (a === 'skip') finish({ title: 'Skipped', body: `Saved in History. ${nextText}`, color: C.onNight2 });
    if (a === 'snooze') {
      const until = after?.at ?? at + (snoozeMin ?? settings.snoozeMin) * 60000;
      finish({ title: `Snoozed until ${fmtTimeFull(until)}`, body: nx ? `The rest of the routine waits too. ${nextText}` : 'It will ring again.', color: '#FFC46B' });
    }
  };

  if (!alarm) {
    return (
      <View style={{ flex: 1, backgroundColor: C.night, alignItems: 'center', justifyContent: 'center' }}>
        <Pressable onPress={close} accessibilityRole="button" style={{ padding: 20 }}>
          <Txt color="#FFFFFF" weight="bold">
            Back to Today
          </Txt>
        </Pressable>
      </View>
    );
  }

  const t = fmtTime(now);
  const snoozesLeft = dose ? dose.snoozes < settings.maxRings : true;
  const title = dose?.item.title ?? alarm.title;
  const detail = dose ? `${dose.item.number ? `#${dose.item.number} · ` : ''}${dose.item.detail}` : alarm.body;
  const note = dose?.item.note ?? '';
  const doneLabel = dose?.item.doneLabel || alarm.doneLabel || 'Done';

  return (
    <View style={{ flex: 1, backgroundColor: C.night }}>
      <StatusBar style="light" />
      <View style={{ flex: 1, width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20, paddingHorizontal: 22 }}>
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <Txt size={12} weight="heavy" color={accent} style={{ letterSpacing: 0.9, textTransform: 'uppercase', flexShrink: 1 }} numberOfLines={1}>
              {isTest ? 'Test alarm' : (dose?.routine.name ?? alarm.subtitle)}
            </Txt>
            {dose && dose.of > 1 ? (
              <Txt size={13} weight="semibold" color={C.onNight2}>
                {dose.index + 1} of {dose.of}
              </Txt>
            ) : null}
          </View>
          {dose && dose.of > 1 ? <Segments index={dose.index} of={dose.of} accent={accent} done={!!outcome} /> : null}
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 }}>
          <View style={{ alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Txt display size={84} weight="bold" color="#FFFFFF" lh={1} maxFontSizeMultiplier={1.1} style={{ letterSpacing: -2 }}>
                {t.time}
              </Txt>
              <Txt size={20} weight="bold" color={C.onNight2}>
                {t.ap}
              </Txt>
            </View>
            <Txt size={14} weight="medium" color={C.onNight3}>
              {fmtDateLong(todayKey(now))}
            </Txt>
          </View>

          <Glow active={!outcome} accent={accent}>
            {dose ? <ItemTile item={dose.item} size={112} radius={56} /> : <View style={{ width: 112, height: 112, borderRadius: 56, backgroundColor: '#FFF1DA', alignItems: 'center', justifyContent: 'center' }}><Icon name="bell" size={52} color="#C86A0C" /></View>}
          </Glow>

          <View style={{ alignItems: 'center', gap: 8, maxWidth: 340 }}>
            <Txt display size={30} weight="bold" color="#FFFFFF" align="center" lh={1.12}>
              {title}
            </Txt>
            <Txt size={17} weight="medium" color="#DCE1EE" align="center">
              {detail}
            </Txt>
            {note ? (
              <View style={{ backgroundColor: C.night2, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
                <Txt size={13} weight="semibold" color="#DCE3F5" align="center">
                  {note}
                </Txt>
              </View>
            ) : null}
            {dose && dose.snoozes > 0 && !outcome ? (
              <Txt size={13} weight="bold" color="#FFC46B">
                Snoozed {dose.snoozes} of {settings.maxRings} times
              </Txt>
            ) : null}
          </View>
        </View>

        {outcome ? (
          <View style={{ backgroundColor: C.night2, borderRadius: 20, padding: 18, gap: 6 }} accessibilityLiveRegion="polite">
            <Txt size={18} weight="heavy" color={outcome.color}>
              {outcome.title}
            </Txt>
            <Txt size={14} color="#DCE1EE">
              {outcome.body}
            </Txt>
          </View>
        ) : choosing ? (
          <View style={{ gap: 14, backgroundColor: C.night2, borderRadius: 20, padding: 16 }}>
            <SnoozeChoices dark defaultMin={settings.snoozeMin} onPick={(m) => answer('snooze', m)} />
            <Pressable onPress={() => setChoosing(false)} accessibilityRole="button" style={{ alignSelf: 'center', padding: 8 }}>
              <Txt size={14} weight="bold" color={C.onNight2}>
                Back
              </Txt>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <BigBtn label={doneLabel} icon onPress={() => answer('done')} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <OutlineBtn label={snoozesLeft ? `Snooze ${settings.snoozeMin} min` : 'No snoozes left'} disabled={!snoozesLeft} onPress={() => answer('snooze')} />
              <OutlineBtn label="Skip" onPress={() => answer('skip')} />
            </View>
            {snoozesLeft ? (
              <Pressable onPress={() => setChoosing(true)} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' }}>
                <Txt size={14} weight="bold" color={C.onNight2}>
                  Snooze for another time…
                </Txt>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

function Segments({ index, of, accent, done }: { index: number; of: number; accent: string; done: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }} accessibilityLabel={`${index + 1} of ${of}`}>
      {Array.from({ length: of }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < index || (done && i === index) ? '#2BC48A' : i === index ? accent : C.night3 }} />
      ))}
    </View>
  );
}

/** Two soft rings pulsing outward, like a firefly glowing. Still when reduce-motion is on. */
function Glow({ children, active, accent }: { children: React.ReactNode; active: boolean; accent: string }) {
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;
  const [still, setStill] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {});
  }, []);
  useEffect(() => {
    if (!active || still) return;
    const loop = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );
    const l1 = loop(a, 0);
    const l2 = loop(b, 1100);
    l1.start();
    l2.start();
    return () => {
      l1.stop();
      l2.stop();
    };
  }, [active, still, a, b]);
  const ring = (v: Animated.Value) => ({
    position: 'absolute' as const,
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
    borderColor: accent,
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.62, 1.15] }) }],
  });
  return (
    <View style={{ width: 190, height: 190, alignItems: 'center', justifyContent: 'center' }}>
      {active && !still ? (
        <>
          <Animated.View style={ring(a)} />
          <Animated.View style={ring(b)} />
        </>
      ) : null}
      {children}
    </View>
  );
}

function BigBtn({ label, onPress, icon }: { label: string; onPress: () => void; icon?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ minHeight: 64, borderRadius: 20, backgroundColor: '#FFFFFF', flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}
    >
      {icon ? <Icon name="check" size={22} color={C.night} stroke={3} /> : null}
      <Txt size={19} weight="heavy" color={C.night}>
        {label}
      </Txt>
    </Pressable>
  );
}

function OutlineBtn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 56,
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: '#3A4466',
        borderStyle: disabled ? 'dashed' : 'solid',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Txt size={15} weight="bold" color={disabled ? C.onNight3 : '#FFFFFF'} align="center">
        {label}
      </Txt>
    </Pressable>
  );
}
