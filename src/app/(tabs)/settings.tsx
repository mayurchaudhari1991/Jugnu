import Constants from 'expo-constants';
import { Alert, Platform, Pressable, Share, ToastAndroid, View } from 'react-native';
import type { NativePermissions } from '../../../modules/jugnu-alarm';
import JugnuAlarm from '../../../modules/jugnu-alarm';
import { hasNative, syncAlarms, testAlarm } from '@/core/engine';
import { makerTip, requestNotifications, usePermissions } from '@/core/hooks';
import { IS_PERSONAL } from '@/core/seed';
import { useStore } from '@/core/store';
import { AccountCard } from '@/ui/account';
import type { Vibe } from '@/core/types';
import { Icon, JugnuMark, type UIIconName } from '@/ui/icons';
import { Btn, Card, Chip, Divider, Screen, Stepper, Toggle } from '@/ui/kit';
import { C } from '@/ui/theme';
import { MinutesStepper, SNOOZE_QUICK, SoundPicker } from '@/ui/pickers';
import { Txt } from '@/ui/Txt';

const RING_STEPS = [30, 60, 120, 180, 300];
const VIBES: { key: Vibe; label: string }[] = [
  { key: 'pulse', label: 'Pulse' },
  { key: 'heartbeat', label: 'Heartbeat' },
  { key: 'long', label: 'Long buzz' },
  { key: 'gentle', label: 'Gentle' },
  { key: 'off', label: 'Off' },
];
const SILENT = { uri: 'silent', title: 'Vibrate only' };

export default function Settings() {
  const settings = useStore((s) => s.settings);
  const set = useStore((s) => s.setSettings);
  const { perms, refresh } = usePermissions();
  const tip = makerTip();

  const ringIdx = Math.max(0, RING_STEPS.indexOf(settings.ringSec));
  const ringLabel = settings.ringSec < 60 ? `${settings.ringSec} s` : `${settings.ringSec / 60} min`;

  return (
    <Screen>
      <Txt display size={32} weight="bold" lh={1.1}>
        Settings
      </Txt>

      <AccountCard />

      <Card style={{ gap: 4 }}>
        <Txt size={15} weight="heavy" style={{ marginBottom: 4 }}>
          So alarms always ring
        </Txt>
        <PermRow
          icon="bell"
          title="Notifications"
          ok={perms.notifications}
          help="Needed for any alarm to show"
          onFix={async () => {
            await requestNotifications();
            refresh();
          }}
        />
        <Divider />
        <PermRow
          icon="bell"
          title="Pop-up (banner) notifications"
          ok={perms.popup}
          help="Your phone turned these off. In Jugnu's notification settings, switch on Banners / Floating notifications and Lock screen."
          onFix={() => JugnuAlarm?.openNotificationSettings()}
        />
        <Divider />
        <PermRow icon="alert" title="Full-screen alarms" ok={perms.fullScreen} help="Lets the alarm fill the lock screen" onFix={() => JugnuAlarm?.openFullScreenSettings()} />
        <Divider />
        <PermRow icon="alert" title="Turn screen on" ok={perms.screenOn} help="Lets the alarm light up a sleeping phone" onFix={() => JugnuAlarm?.openScreenOnSettings()} />
        <Divider />
        <PermRow
          icon="alert"
          title="Display over other apps"
          ok={perms.overlay}
          help="Opens the alarm page while you're using another app"
          onFix={() => JugnuAlarm?.openOverlaySettings()}
          optional
        />
        <Divider />
        <PermRow icon="clock" title="Exact alarm times" ok={perms.exact} help="Rings at the exact minute" onFix={() => JugnuAlarm?.openExactAlarmSettings()} />
        <Divider />
        {tip ? (
          <>
            <Divider />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 6 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: settings.oemDone ? C.doneTint : C.warnTint }}>
                <Icon name={settings.oemDone ? 'check' : 'shield'} size={19} color={settings.oemDone ? C.doneText : C.warnText} stroke={settings.oemDone ? 3 : 2} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Txt size={15} weight="bold">
                  {tip.title}
                </Txt>
                <Txt size={12.5} color={C.ink2}>
                  {settings.oemDone ? 'Done. Your phone lets the alarm page open by itself.' : tip.help}
                </Txt>
                <Pressable onPress={() => set({ oemDone: !settings.oemDone })} accessibilityRole="checkbox" accessibilityState={{ checked: settings.oemDone }} style={{ paddingVertical: 6 }}>
                  <Txt size={13} weight="heavy" color={C.ink}>
                    {settings.oemDone ? 'Mark as not done' : "I've done this"}
                  </Txt>
                </Pressable>
              </View>
              <Btn label="Open" onPress={() => JugnuAlarm?.openAppInfo()} style={{ minHeight: 40, paddingHorizontal: 14 }} />
            </View>
          </>
        ) : null}
        <Divider />
        <PermRow
          icon="battery"
          title="Run in background"
          ok={perms.battery}
          help="Stops the phone's battery saver from delaying alarms"
          onFix={() => JugnuAlarm?.requestIgnoreBattery()}
          optional
        />
      </Card>

      <Card style={{ gap: 2 }}>
        <Txt size={15} weight="heavy" style={{ marginBottom: 4 }}>
          Alarm
        </Txt>
        <MinutesStepper
          label="Snooze length"
          help="Any minutes — tap the number to type. Also used between re-rings."
          value={settings.snoozeMin}
          min={1}
          max={720}
          quick={SNOOZE_QUICK}
          onChange={(snoozeMin) => set({ snoozeMin })}
        />
        <Divider />
        <Stepper
          label="Ring if no answer"
          help="Then it's marked missed and the routine carries on"
          value={`${settings.maxRings}×`}
          onDec={() => set({ maxRings: Math.max(1, settings.maxRings - 1) })}
          onInc={() => set({ maxRings: Math.min(5, settings.maxRings + 1) })}
        />
        <Divider />
        <Stepper
          label="Each ring lasts"
          help="Before it goes quiet until the next ring"
          value={ringLabel}
          onDec={() => set({ ringSec: RING_STEPS[Math.max(0, ringIdx - 1)] })}
          onInc={() => set({ ringSec: RING_STEPS[Math.min(RING_STEPS.length - 1, ringIdx + 1)] })}
        />
        <Divider />
        {settings.sound.uri !== 'silent' ? (
          <>
            <SoundPicker label="Alarm sound" value={settings.sound} onChange={(s) => set({ sound: s ?? { uri: '', title: 'Phone default alarm' } })} />
            <Divider />
          </>
        ) : null}
        <View style={{ gap: 10, paddingVertical: 10 }}>
          <Txt size={15} weight="bold">
            Vibration
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {VIBES.map((v) => (
              <Chip
                key={v.key}
                label={v.label}
                on={(settings.vibrate ?? 'pulse') === v.key}
                onPress={() => set(v.key === 'off' && settings.sound.uri === 'silent' ? { vibrate: 'off', sound: { uri: '', title: 'Phone default alarm' } } : { vibrate: v.key })}
              />
            ))}
          </View>
        </View>
        <Divider />
        <Toggle
          label="Vibrate only, no sound"
          help="For meetings, the library, or a sleeping baby"
          on={settings.sound.uri === 'silent'}
          onChange={(on) =>
            set(on ? { sound: SILENT, vibrate: settings.vibrate === 'off' ? 'pulse' : settings.vibrate } : { sound: { uri: '', title: 'Phone default alarm' } })
          }
        />
        <Divider />
        <Pressable
          onPress={() => JugnuAlarm?.openSoundSettings()}
          accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 }}
        >
          <View style={{ flex: 1 }}>
            <Txt size={15} weight="bold">
              Vibration and more
            </Txt>
            <Txt size={12.5} color={C.ink2}>
              Android's own settings for Jugnu alarms
            </Txt>
          </View>
          <Icon name="chevR" size={18} color={C.ink3} />
        </Pressable>
      </Card>

      <Btn
        label="Test alarm in 10 seconds"
        icon="bell"
        tall
        onPress={() => {
          if (!testAlarm(10)) {
            Alert.alert('Not available here', 'Alarms only ring in the installed Jugnu app.');
            return;
          }
          ToastAndroid.show('Test alarm in 10 seconds. Lock your phone now.', ToastAndroid.LONG);
        }}
      />

      <Card style={{ gap: 12 }}>
        <Txt size={15} weight="heavy">
          Your data
        </Txt>
        <Txt size={13.5} color={C.ink2}>
          Everything stays on this phone. Nothing is uploaded.
        </Txt>
        <Btn
          label="Re-book all alarms"
          kind="secondary"
          icon="repeat"
          onPress={() => {
            const n = syncAlarms();
            Alert.alert('Alarms booked', hasNative ? `${n} alarms for the next 7 days.` : 'Alarms only work in the installed app.');
          }}
        />
        <Btn
          label={IS_PERSONAL ? 'Start over with my prescription' : 'Start over (delete everything)'}
          kind="danger"
          onPress={() =>
            Alert.alert(
              'Start over?',
              IS_PERSONAL
                ? 'Deletes all routines, reminders and history, then loads the 9 prescription medicines again.'
                : 'Deletes all routines, reminders and history on this phone.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Start over', style: 'destructive', onPress: () => useStore.getState().resetAll() },
              ],
            )
          }
        />
        <Btn
          label="Try examples"
          kind="secondary"
          onPress={() => useStore.getState().loadExamples()}
        />
      </Card>

      <Card style={{ gap: 10 }}>
        <Txt size={15} weight="heavy">
          Tell us what you think
        </Txt>
        <Txt size={13.5} color={C.ink2}>
          Opens WhatsApp, Gmail or any app, with your phone details filled in so problems are easy to fix.
        </Txt>
        <Btn label="Send feedback" icon="edit" onPress={() => sendFeedback(perms, settings.oemDone)} />
      </Card>

      <View style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
        <View style={{ borderRadius: 16, overflow: 'hidden' }}>
          <JugnuMark size={56} />
        </View>
        <Txt display size={20} weight="bold">
          Jugnu
        </Txt>
        <Txt size={13} color={C.ink2}>
          Har yaad, ek roshni. · v{Constants.expoConfig?.version ?? '1.0.0'}
        </Txt>
      </View>
    </Screen>
  );
}

function sendFeedback(perms: NativePermissions, oemDone: boolean) {
  const c = (Platform.constants ?? {}) as { Manufacturer?: string; Model?: string; Release?: string };
  const missing = [
    !perms.notifications && 'notifications',
    !perms.popup && 'pop-up',
    !perms.fullScreen && 'full-screen',
    !perms.overlay && 'overlay',
    !perms.exact && 'exact alarms',
    !perms.battery && 'battery',
  ].filter(Boolean);
  const message = [
    `Jugnu feedback (v${Constants.expoConfig?.version ?? '?'})`,
    `Phone: ${c.Manufacturer ?? '?'} ${c.Model ?? ''}, Android ${c.Release ?? Platform.Version}`,
    `Alarm setup: ${missing.length ? `missing ${missing.join(', ')}` : 'all allowed'}${makerTip() ? `, phone step ${oemDone ? 'done' : 'not done'}` : ''}`,
    '',
    'What I liked:',
    '',
    "What didn't work:",
    '',
    'Ideas:',
    '',
  ].join('\n');
  Share.share({ message }).catch(() => {});
}

function PermRow({ icon, title, help, ok, onFix, optional }: { icon: UIIconName; title: string; help: string; ok: boolean; onFix: () => void; optional?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 6 }}>
      <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: ok ? C.doneTint : optional ? C.chip : C.warnTint }}>
        <Icon name={ok ? 'check' : icon} size={19} color={ok ? C.doneText : optional ? C.ink2 : C.warnText} stroke={ok ? 3 : 2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt size={15} weight="bold">
          {title}
        </Txt>
        <Txt size={12.5} color={C.ink2}>
          {ok ? 'Allowed' : help}
        </Txt>
      </View>
      {ok ? null : <Btn label={optional ? 'Allow' : 'Fix'} onPress={onFix} style={{ minHeight: 40, paddingHorizontal: 14 }} />}
    </View>
  );
}
