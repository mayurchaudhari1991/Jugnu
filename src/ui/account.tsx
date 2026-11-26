import { router } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Share, View } from 'react-native';
import { cloudConfigured, planActive, planText, refreshProfile, signInWithGoogle, signOut, useAccount } from '@/core/cloud';
import { Btn, Card } from './kit';
import { C } from './theme';
import { Txt } from './Txt';

/** Settings card: Google sign-in, the plan, and the way to ask for Jugnu Pro. */
export function AccountCard() {
  const { session, profile, busy, error } = useAccount();
  useEffect(() => {
    if (session) refreshProfile();
  }, [session]);
  if (!cloudConfigured) return null;

  if (!session) {
    return (
      <Card style={{ gap: 10 }}>
        <Txt size={15} weight="heavy">
          Jugnu AI
        </Txt>
        <Txt size={13.5} color={C.ink2}>
          Scan a prescription and Jugnu sets up every medicine, or type a reminder in your own words. Sign in to start your free trial. Alarms work without an account.
        </Txt>
        {error ? (
          <Txt size={13} color={C.danger}>
            {error}
          </Txt>
        ) : null}
        <Btn label={busy ? 'Opening Google…' : 'Sign in with Google'} onPress={signInWithGoogle} disabled={busy} />
      </Card>
    );
  }

  const active = planActive(profile);
  const name = profile?.name || session.user.email || 'You';
  const email = profile?.email ?? session.user.email ?? '';

  const askPro = () =>
    Share.share({
      message: `Hi! I'd like Jugnu Pro.\nMy Jugnu account: ${email}\nI'll pay by UPI / cash.`,
    }).catch(() => {});

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.night, alignItems: 'center', justifyContent: 'center' }}>
          <Txt size={18} weight="heavy" color="#FFE45C">
            {name.slice(0, 1).toUpperCase()}
          </Txt>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt size={15.5} weight="heavy" numberOfLines={1}>
            {name}
          </Txt>
          <Txt size={12.5} color={C.ink2} numberOfLines={1}>
            {email}
          </Txt>
        </View>
      </View>

      <View style={{ backgroundColor: active ? C.doneTint : C.warnTint, borderRadius: 14, padding: 12, gap: 2 }}>
        <Txt size={14.5} weight="heavy" color={active ? C.doneText : C.warnText}>
          {profile ? planText(profile) : 'Checking your plan…'}
        </Txt>
        <Txt size={12.5} color={active ? C.doneText : C.warnText}>
          {active ? 'Jugnu AI is on: prescription scan and typed reminders.' : 'Pay by UPI or cash and we turn on Jugnu Pro for this account.'}
        </Txt>
      </View>
      {error ? (
        <Txt size={13} color={C.danger}>
          {error}
        </Txt>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {active ? (
          <Btn label="Scan prescription" onPress={() => router.push('/scan')} style={{ flex: 1 }} />
        ) : (
          <Btn label="Ask for Jugnu Pro" onPress={askPro} style={{ flex: 1 }} />
        )}
        {profile?.is_admin ? <Btn label="Admin" kind="secondary" onPress={() => router.push('/admin')} style={{ flex: 1 }} /> : null}
      </View>
      <Btn
        label="Sign out"
        kind="ghost"
        onPress={() =>
          Alert.alert('Sign out?', 'Your alarms and routines stay on this phone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', onPress: () => signOut() },
          ])
        }
      />
    </Card>
  );
}
