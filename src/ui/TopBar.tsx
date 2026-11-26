import { router } from 'expo-router';
import { View } from 'react-native';
import { Btn, IconBtn } from './kit';
import { Txt } from './Txt';

const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

/** `right={false}` hides the Done button (screens where leaving shouldn't look like saving). */
export function TopBar({ title, right }: { title: string; right?: React.ReactNode | false }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <IconBtn name="chevL" label="Back" onPress={back} />
      <Txt display size={22} weight="bold" style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </Txt>
      {right === false ? null : (right ?? <Btn label="Done" onPress={back} style={{ minHeight: 44 }} />)}
    </View>
  );
}
