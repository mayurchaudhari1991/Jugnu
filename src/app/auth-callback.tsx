import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { finishSignIn, useAccount } from '@/core/cloud';
import { C } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

/** Where Google sign-in returns (jugnu://auth-callback?code=…) when the phone opens the app directly. */
export default function AuthCallback() {
  const { code, error_description } = useLocalSearchParams<{ code?: string; error_description?: string }>();
  useEffect(() => {
    (async () => {
      try {
        if (error_description) useAccount.setState({ error: String(error_description).replace(/\+/g, ' ') });
        else if (code) await finishSignIn(String(code));
      } catch (e) {
        useAccount.setState({ error: e instanceof Error ? e.message : String(e) });
      }
      router.replace('/settings');
    })();
  }, [code, error_description]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: C.bg }}>
      <ActivityIndicator color={C.ink} />
      <Txt size={15} color={C.ink2}>
        Signing you in…
      </Txt>
    </View>
  );
}
