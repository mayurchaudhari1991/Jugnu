import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import JugnuAlarm from '../../modules/jugnu-alarm';
import { syncAlarms } from '@/core/engine';
import { makerTip, requestNotifications, usePermissions } from '@/core/hooks';
import { IS_PERSONAL } from '@/core/seed';
import { useStore } from '@/core/store';
import { Icon, JugnuMark } from '@/ui/icons';
import { Btn } from '@/ui/kit';
import { C, MAX_W } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

export default function Setup() {
  const insets = useSafeAreaInsets();
  const { perms, refresh } = usePermissions();
  const tip = makerTip();
  const routineCount = useStore((s) => s.routines.length);
  const oemDone = useStore((s) => s.settings.oemDone);

  const steps = [
    {
      title: 'Allow notifications',
      help: 'So reminders can appear at all.',
      ok: perms.notifications,
      action: async () => {
        await requestNotifications();
        refresh();
      },
    },
    {
      title: 'Turn on pop-up notifications',
      help: 'OnePlus, Oppo, Xiaomi and Vivo switch these off. In the page that opens, turn on Banners (Floating notifications) and Lock screen.',
      ok: perms.popup,
      action: () => JugnuAlarm?.openNotificationSettings(),
    },
    {
      title: 'Allow full-screen alarms',
      help: 'So the alarm fills your lock screen, like a real alarm clock.',
      ok: perms.fullScreen,
      action: () => JugnuAlarm?.openFullScreenSettings(),
    },
    {
      title: 'Allow turning the screen on',
      help: 'So a sleeping phone lights up when the alarm rings. In the page that opens, switch Jugnu on.',
      ok: perms.screenOn,
      action: () => JugnuAlarm?.openScreenOnSettings(),
    },
    {
      title: 'Display over other apps',
      help: "So the alarm page opens even while you're in another app.",
      ok: perms.overlay,
      action: () => JugnuAlarm?.openOverlaySettings(),
    },
    ...(tip
      ? [
          {
            title: tip.title,
            help: tip.help,
            ok: oemDone,
            action: () => {
              JugnuAlarm?.openAppInfo();
              useStore.getState().setSettings({ oemDone: true });
            },
          },
        ]
      : []),
    {
      title: 'Let Jugnu run in the background',
      help: "So the phone's battery saver never delays an alarm.",
      ok: perms.battery,
      action: () => JugnuAlarm?.requestIgnoreBattery(),
    },
  ];

  const start = () => {
    useStore.getState().setSettings({ setupDone: true });
    syncAlarms();
    router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.night }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24, paddingHorizontal: 22 }}>
        <View style={{ width: '100%', maxWidth: MAX_W, alignSelf: 'center', gap: 22 }}>
          <View style={{ alignItems: 'center', gap: 12 }}>
            <View style={{ borderRadius: 36, overflow: 'hidden' }}>
              <JugnuMark size={132} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
              <Txt display size={44} weight="heavy" color="#FFFFFF" lh={1.05}>
                Jugnu
              </Txt>
              <Txt size={22} weight="bold" color={C.glow}>
                जुगनू
              </Txt>
            </View>
            <Txt size={17} weight="bold" color={C.onNight2} align="center">
              Har yaad, ek roshni.
            </Txt>
            <Txt size={14.5} color={C.onNight3} align="center" style={{ maxWidth: 360 }}>
              {IS_PERSONAL
                ? 'Reminders for anything that ring like a real alarm. Your 9 medicines are already set up in 4 routines.'
                : 'Reminders for anything that ring like a real alarm: medicines, gym, water, bills, birthdays.'}
            </Txt>
          </View>

          <View style={{ gap: 10 }}>
            {steps.map((st, i) => (
              <View key={st.title} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.night2, borderRadius: 18, padding: 14 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: st.ok ? '#2BC48A' : C.night3 }}>
                  {st.ok ? <Icon name="check" size={18} color="#FFFFFF" stroke={3} /> : <Txt size={15} weight="heavy" color="#FFFFFF">{i + 1}</Txt>}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt size={15} weight="bold" color="#FFFFFF">
                    {st.title}
                  </Txt>
                  <Txt size={12.5} color={C.onNight3}>
                    {st.ok ? 'Done' : st.help}
                  </Txt>
                </View>
                {st.ok ? null : <Btn label="Allow" kind="light" onPress={st.action} style={{ minHeight: 40, paddingHorizontal: 14 }} />}
              </View>
            ))}
          </View>

          {!IS_PERSONAL && routineCount === 0 ? (
            <Btn
              label="Start with examples"
              kind="light"
              tall
              onPress={() => {
                useStore.getState().loadExamples();
                start();
              }}
            />
          ) : null}
          <Btn
            label={perms.notifications ? (!IS_PERSONAL && routineCount === 0 ? 'Start empty' : 'Start') : 'Start anyway'}
            kind={!IS_PERSONAL && routineCount === 0 ? 'onDark' : 'light'}
            tall
            onPress={start}
          />
          <Txt size={12.5} color={C.onNight3} align="center">
            You can change all of this later in Settings.
          </Txt>
        </View>
      </ScrollView>
    </View>
  );
}
