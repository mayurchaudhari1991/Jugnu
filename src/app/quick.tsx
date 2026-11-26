import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { applyReminder } from '@/core/ai-apply';
import { AiError, parseReminder, planActive, signInWithGoogle, useAccount } from '@/core/cloud';
import { syncAlarms } from '@/core/engine';
import { FireflyLoader } from '@/ui/FireflyLoader';
import { Banner, Btn, Card, Chip, Field, Screen } from '@/ui/kit';
import { C } from '@/ui/theme';
import { TopBar } from '@/ui/TopBar';
import { Txt } from '@/ui/Txt';

const EXAMPLES = ['Pay electricity bill on the 10th every month at 11 am', 'Gym every Mon, Wed and Fri at 6:30 pm', 'Kal subah 7 baje Papa ko call karna', "Mom's birthday on 14 March"];

/** Type a reminder in plain words; Jugnu AI fills in the time and repeat, then the editor opens to check it. */
export default function Quick() {
  const { session, profile, busy: signingIn } = useAccount();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const parsed = await parseReminder(text.trim());
      const id = applyReminder(parsed);
      syncAlarms();
      router.replace({ pathname: '/routine/[id]', params: { id, fresh: '1' } });
    } catch (e) {
      setError(e instanceof AiError || e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <TopBar title="Type a reminder" right={false} />
      {!session ? (
        <Card style={{ gap: 10 }}>
          <Txt size={14} color={C.ink2}>
            Sign in to use Jugnu AI. New accounts get a free trial.
          </Txt>
          <Btn label={signingIn ? 'Opening Google…' : 'Sign in with Google'} onPress={signInWithGoogle} disabled={signingIn} />
        </Card>
      ) : profile && !planActive(profile) ? (
        <Card style={{ gap: 10 }}>
          <Txt size={14} color={C.ink2}>
            Jugnu AI needs an active plan. See Settings → Jugnu AI.
          </Txt>
          <Btn label="Open Settings" onPress={() => router.push('/settings')} />
        </Card>
      ) : (
        <>
          <Txt size={14.5} color={C.ink2}>
            Say it the way you'd tell a friend, in English or Hinglish. You'll check it before it's final.
          </Txt>
          <Field label="Remind me to…" value={text} onChangeText={setText} placeholder="Pay rent on the 5th every month at 10 am" multiline autoFocus maxLength={400} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {EXAMPLES.map((e) => (
              <Chip key={e} label={e} on={false} onPress={() => setText(e)} />
            ))}
          </View>
          {error ? <Banner text={error} action="" onPress={() => setError(null)} /> : null}
          {busy ? (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <FireflyLoader size={64} />
              <Txt size={15} weight="bold">
                Jugnu is setting it up…
              </Txt>
            </Card>
          ) : (
            <Btn label="Make reminder" icon="check" onPress={go} disabled={text.trim().length < 3} />
          )}
        </>
      )}
    </Screen>
  );
}
