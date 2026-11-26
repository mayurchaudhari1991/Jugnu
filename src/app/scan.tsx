import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ToastAndroid, View } from 'react-native';
import { applyScan, PARTS, type Part } from '@/core/ai-apply';
import { AiError, planActive, planText, scanPrescription, signInWithGoogle, useAccount, type ScanItem } from '@/core/cloud';
import { syncAlarms } from '@/core/engine';
import { Icon } from '@/ui/icons';
import { Banner, Btn, Card, Chip, Field, Label, Screen } from '@/ui/kit';
import { C } from '@/ui/theme';
import { TopBar } from '@/ui/TopBar';
import { Txt } from '@/ui/Txt';

type Photo = { uri: string; b64: string };
type Row = ScanItem & { keep: boolean };

const FOODS: { key: ScanItem['food']; label: string }[] = [
  { key: 'before', label: 'Before food' },
  { key: 'after', label: 'After food' },
  { key: 'with', label: 'With food' },
  { key: 'any', label: 'Any time' },
];

/** Shrinks a photo to ~1600 px wide JPEG: sharp enough for handwriting, small enough to send. */
async function prepare(uri: string): Promise<Photo> {
  const ref = await ImageManipulator.manipulate(uri).resize({ width: 1600 }).renderAsync();
  const out = await ref.saveAsync({ compress: 0.72, format: SaveFormat.JPEG, base64: true });
  return { uri: out.uri, b64: out.base64 ?? '' };
}

export default function Scan() {
  const { session, profile, busy: signingIn, error: accountError } = useAccount();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const add = async (from: 'camera' | 'gallery') => {
    setError(null);
    if (from === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return setError('Jugnu needs the camera to take the photo. You can also pick one from the gallery.');
    }
    const res =
      from === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 4 - photos.length, quality: 1 });
    if (res.canceled) return;
    try {
      const ready = await Promise.all(res.assets.map((a) => prepare(a.uri)));
      setPhotos((p) => [...p, ...ready].slice(0, 4));
    } catch {
      setError("Couldn't open that photo. Try another one.");
    }
  };

  const read = async () => {
    setReading(true);
    setError(null);
    try {
      const r = await scanPrescription(photos.map((p) => p.b64));
      setRows(r.items.map((i) => ({ ...i, times: i.times.filter((t) => PARTS.some((p) => p.key === t)), keep: true })));
      setWarnings(r.warnings);
    } catch (e) {
      setError(e instanceof AiError || e instanceof Error ? e.message : String(e));
    } finally {
      setReading(false);
    }
  };

  const edit = (i: number, patch: Partial<Row>) => setRows((rs) => rs!.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const toggleTime = (i: number, t: Part) => {
    const r = rows![i];
    const times = r.times.includes(t) ? r.times.filter((x) => x !== t) : PARTS.map((p) => p.key).filter((k) => k === t || r.times.includes(k));
    edit(i, { times, perDay: times.length });
  };

  const save = () => {
    const added = applyScan(rows!);
    syncAlarms();
    ToastAndroid.show(`Added ${rows!.filter((r) => r.keep).length} medicines · ${added} alarms a day`, ToastAndroid.LONG);
    router.replace('/routines');
  };

  // ------------------------------------------------------------ not signed in / no plan
  if (!session) {
    return (
      <Screen>
        <TopBar title="Scan prescription" right={false} />
        <Card style={{ gap: 12 }}>
          <Txt size={17} weight="heavy">
            Sign in to use Jugnu AI
          </Txt>
          <Txt size={14} color={C.ink2}>
            Jugnu AI reads your prescription and sets up every medicine for you. New accounts get a free trial. Your alarms keep working without an account.
          </Txt>
          {accountError ? <Txt size={13} color={C.danger}>{accountError}</Txt> : null}
          <Btn label={signingIn ? 'Opening Google…' : 'Sign in with Google'} onPress={signInWithGoogle} disabled={signingIn} />
        </Card>
      </Screen>
    );
  }
  if (profile && !planActive(profile)) {
    return (
      <Screen>
        <TopBar title="Scan prescription" right={false} />
        <Card style={{ gap: 10 }}>
          <Txt size={17} weight="heavy">
            {planText(profile)}
          </Txt>
          <Txt size={14} color={C.ink2}>
            Jugnu AI needs an active plan. Pay by UPI or cash and we'll turn on Jugnu Pro for your account ({profile.email}).
          </Txt>
          <Btn label="How to get Jugnu Pro" onPress={() => router.push('/settings')} />
        </Card>
      </Screen>
    );
  }

  // ------------------------------------------------------------ review
  if (rows) {
    const kept = rows.filter((r) => r.keep && r.name.trim());
    return (
      <Screen bottomPad={40}>
        <TopBar title="Check and save" right={false} />
        <Txt size={14} color={C.ink2}>
          Jugnu AI read {rows.length} medicine{rows.length === 1 ? '' : 's'}. Check each one against the prescription; fix anything that's wrong, then save.
        </Txt>
        {warnings.map((w, i) => (
          <Banner key={i} text={w} action="" onPress={() => {}} />
        ))}
        {rows.length === 0 ? (
          <Card style={{ gap: 10 }}>
            <Txt size={15} weight="bold">
              No medicines found
            </Txt>
            <Btn label="Try another photo" kind="secondary" onPress={() => setRows(null)} />
          </Card>
        ) : null}
        {rows.map((r, i) => (
          <Card key={i} style={{ gap: 12, opacity: r.keep ? 1 : 0.55 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Txt size={13} weight="heavy" color={C.ink2} style={{ flex: 1 }}>
                MEDICINE {i + 1}
                {r.confidence < 0.6 ? '  ·  HARD TO READ, PLEASE CHECK' : ''}
              </Txt>
              <Pressable onPress={() => edit(i, { keep: !r.keep })} accessibilityRole="checkbox" accessibilityState={{ checked: r.keep }} hitSlop={10}>
                <Txt size={13.5} weight="heavy" color={r.keep ? C.danger : C.doneText}>
                  {r.keep ? 'Leave out' : 'Add back'}
                </Txt>
              </Pressable>
            </View>
            <Field label="Name" value={r.name} onChangeText={(name) => edit(i, { name })} />
            <Field label="Dose each time" value={r.dose} onChangeText={(dose) => edit(i, { dose })} placeholder="1 tablet" />
            <View style={{ gap: 8 }}>
              <Label>When</Label>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {PARTS.map((p) => (
                  <Chip key={p.key} label={p.label} on={r.times.includes(p.key)} onPress={() => toggleTime(i, p.key)} />
                ))}
              </View>
              {r.times.length === 0 ? (
                <Txt size={12.5} color={C.warnText}>
                  No time picked: this one won't ring (fine for "only when needed").
                </Txt>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {FOODS.map((f) => (
                <Chip key={f.key} label={f.label} on={r.food === f.key} onPress={() => edit(i, { food: f.key })} />
              ))}
            </View>
            <Field label="Note" value={r.notes} onChangeText={(notes) => edit(i, { notes })} placeholder="With warm water" />
          </Card>
        ))}
        {rows.length > 0 ? (
          <>
            <Btn label={`Add ${kept.length} medicine${kept.length === 1 ? '' : 's'}`} icon="check" onPress={save} disabled={kept.length === 0} />
            <Txt size={12} color={C.ink2} style={{ textAlign: 'center' }}>
              They join your Morning, Afternoon, Evening and Night routines (made if missing). Jugnu AI can misread handwriting; always follow your doctor.
            </Txt>
          </>
        ) : null}
      </Screen>
    );
  }

  // ------------------------------------------------------------ pick photos
  return (
    <Screen>
      <TopBar title="Scan prescription" right={false} />
      <Txt size={14.5} color={C.ink2}>
        Take a clear photo of the whole prescription in good light. Jugnu AI lists every medicine with its times; you check it before anything is saved.
      </Txt>
      {profile ? (
        <Txt size={12.5} weight="bold" color={C.ink2}>
          {planText(profile)}
        </Txt>
      ) : null}

      {photos.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {photos.map((p, i) => (
            <View key={p.uri}>
              <Image source={{ uri: p.uri }} style={{ width: 96, height: 128, borderRadius: 12, backgroundColor: C.chip }} />
              <Pressable
                onPress={() => setPhotos((ps) => ps.filter((_, j) => j !== i))}
                accessibilityLabel="Remove photo"
                style={{ position: 'absolute', top: 4, right: 4, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="x" size={14} color="#FFFFFF" stroke={3} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {photos.length < 4 ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Btn label="Take photo" kind={photos.length ? 'secondary' : 'primary'} onPress={() => add('camera')} style={{ flex: 1 }} />
          <Btn label="From gallery" kind="secondary" onPress={() => add('gallery')} style={{ flex: 1 }} />
        </View>
      ) : null}

      {error ? <Banner text={error} action="" onPress={() => setError(null)} /> : null}

      {photos.length > 0 ? (
        reading ? (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <ActivityIndicator color={C.ink} />
            <View style={{ flex: 1 }}>
              <Txt size={15} weight="bold">
                Reading your prescription…
              </Txt>
              <Txt size={12.5} color={C.ink2}>
                Usually 10–30 seconds.
              </Txt>
            </View>
          </Card>
        ) : (
          <Btn label={photos.length > 1 ? `Read ${photos.length} pages` : 'Read prescription'} icon="check" onPress={read} />
        )
      ) : null}
    </Screen>
  );
}
