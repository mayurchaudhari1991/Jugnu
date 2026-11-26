import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { admin, planText, useAccount, type AdminStats, type AdminUser, type PayMethod, type PlanChange } from '@/core/cloud';
import { Btn, Card, Chip, Divider, Field, Label, Screen, Sheet, Toggle } from '@/ui/kit';
import { C } from '@/ui/theme';
import { TopBar } from '@/ui/TopBar';
import { Txt } from '@/ui/Txt';

const DURATIONS = [
  { days: 30, label: '1 month' },
  { days: 90, label: '3 months' },
  { days: 180, label: '6 months' },
  { days: 365, label: '1 year' },
  { days: 0, label: 'No end' },
];
const METHODS: { key: PayMethod; label: string }[] = [
  { key: 'upi', label: 'UPI' },
  { key: 'cash', label: 'Cash' },
  { key: 'free', label: 'Free' },
  { key: 'other', label: 'Other' },
];

const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export default function Admin() {
  const me = useAccount((s) => s.profile);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<AdminUser | null>(null);

  const load = useCallback(async (q = search) => {
    setLoading(true);
    setError(null);
    try {
      const [s, u, st] = await Promise.all([admin.stats(), admin.users(q.trim()), admin.settings()]);
      setStats(s);
      setUsers(u);
      setSettings(st);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load('');
  }, [load]);

  if (!me?.is_admin) {
    return (
      <Screen>
        <TopBar title="Admin" right={false} />
        <Txt color={C.ink2}>This page is only for Jugnu admins.</Txt>
      </Screen>
    );
  }

  return (
    <Screen bottomPad={40} refresh={<RefreshControl refreshing={loading} onRefresh={() => load(search)} />}>
      <TopBar title="Admin" right={false} />
      {error ? (
        <Card>
          <Txt color={C.danger}>{error}</Txt>
        </Card>
      ) : null}

      {stats ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Stat label="Users" value={String(stats.users)} sub={`+${stats.users_7d} this week`} />
          <Stat label="Pro now" value={String(stats.pro)} sub={`${stats.trials} on free trial`} />
          <Stat label="Ending soon" value={String(stats.expiring_7d)} sub="within 7 days" warn={stats.expiring_7d > 0} />
          <Stat label="Earned" value={rupees(stats.earned_30d)} sub={`last 30 days · ${rupees(stats.earned_total)} total`} />
          <Stat label="AI today" value={String(stats.ai_today)} sub={`${stats.ai_30d} in 30 days`} />
          <Stat label="AI failures" value={String(stats.failures_today)} sub="today" warn={stats.failures_today > 0} />
        </View>
      ) : loading ? (
        <ActivityIndicator color={C.ink} />
      ) : null}

      <SettingsCard settings={settings} onSaved={() => load(search)} />

      <Card style={{ gap: 10 }}>
        <Field
          label="Find a user"
          value={search}
          onChangeText={setSearch}
          placeholder="Name or email"
          returnKeyType="search"
          onSubmitEditing={() => load(search)}
          autoCapitalize="none"
        />
        <Btn label="Search" kind="secondary" onPress={() => load(search)} />
      </Card>

      <Txt size={13} weight="heavy" color={C.ink2}>
        {users.length} USER{users.length === 1 ? '' : 'S'}
      </Txt>
      {users.map((u) => (
        <Pressable key={u.id} onPress={() => setOpen(u)} accessibilityRole="button" accessibilityLabel={`${u.name ?? u.email}, ${planText(u)}`}>
          <Card style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Txt size={15.5} weight="heavy" numberOfLines={1} style={{ flex: 1 }}>
                {u.name || u.email}
                {u.is_admin ? '  · admin' : ''}
              </Txt>
              <PlanBadge u={u} />
            </View>
            <Txt size={13} color={C.ink2} numberOfLines={1}>
              {u.email}
            </Txt>
            <Txt size={12.5} color={C.ink2}>
              {planText(u)} · {u.ai_calls} AI use{u.ai_calls === 1 ? '' : 's'} · seen {day(u.last_seen)}
            </Txt>
          </Card>
        </Pressable>
      ))}

      <UserSheet
        user={open}
        meId={me.id}
        onClose={() => setOpen(null)}
        onChanged={() => {
          setOpen(null);
          load(search);
        }}
      />
    </Screen>
  );
}

function Stat({ label, value, sub, warn }: { label: string; value: string; sub: string; warn?: boolean }) {
  return (
    <View style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: warn ? C.warnTint : C.card, borderRadius: 16, padding: 14, gap: 2, borderWidth: 1, borderColor: C.line }}>
      <Txt size={12} weight="heavy" color={warn ? C.warnText : C.ink2}>
        {label.toUpperCase()}
      </Txt>
      <Txt size={24} weight="heavy" color={warn ? C.warnText : C.ink}>
        {value}
      </Txt>
      <Txt size={12} color={C.ink2}>
        {sub}
      </Txt>
    </View>
  );
}

function PlanBadge({ u }: { u: Pick<AdminUser, 'plan' | 'active'> }) {
  const label = !u.active ? (u.plan === 'none' ? 'No plan' : 'Ended') : u.plan === 'pro' ? 'Pro' : 'Trial';
  const bg = !u.active ? C.chip : u.plan === 'pro' ? C.doneTint : C.warnTint;
  const fg = !u.active ? C.ink2 : u.plan === 'pro' ? C.doneText : C.warnText;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Txt size={12} weight="heavy" color={fg}>
        {label}
      </Txt>
    </View>
  );
}

function SettingsCard({ settings, onSaved }: { settings: Record<string, string>; onSaved: () => void }) {
  const [trial, setTrial] = useState('');
  const [limit, setLimit] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setTrial(settings.trial_days ?? '30');
    setLimit(settings.daily_limit ?? '30');
  }, [settings]);
  const save = async () => {
    setBusy(true);
    try {
      await admin.setSetting('trial_days', String(Math.max(0, parseInt(trial, 10) || 0)));
      await admin.setSetting('daily_limit', String(Math.max(0, parseInt(limit, 10) || 0)));
      onSaved();
    } catch (e) {
      Alert.alert("Couldn't save", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card style={{ gap: 10 }}>
      <Txt size={15} weight="heavy">
        Plan settings
      </Txt>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Field label="Free trial for new users (days)" value={trial} onChangeText={setTrial} keyboardType="number-pad" maxLength={4} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="AI uses per person per day" value={limit} onChangeText={setLimit} keyboardType="number-pad" maxLength={4} />
        </View>
      </View>
      <Txt size={12} color={C.ink2}>
        Trial 0 = new users start with no plan. Daily limit 0 = no limit (keeps AI costs safe).
      </Txt>
      <Btn label={busy ? 'Saving…' : 'Save settings'} kind="secondary" onPress={save} disabled={busy} />
    </Card>
  );
}

function UserSheet({ user, meId, onClose, onChanged }: { user: AdminUser | null; meId: string; onClose: () => void; onChanged: () => void }) {
  const [days, setDays] = useState(30);
  const [extend, setExtend] = useState(true);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PayMethod>('upi');
  const [note, setNote] = useState('');
  const [trialDays, setTrialDays] = useState('30');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<PlanChange[]>([]);

  useEffect(() => {
    if (!user) return;
    setDays(30);
    setExtend(true);
    setAmount('');
    setMethod('upi');
    setNote('');
    setTrialDays('30');
    admin.history(user.id).then(setHistory).catch(() => setHistory([]));
  }, [user]);

  if (!user) return null;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      onChanged();
    } catch (e) {
      Alert.alert("Couldn't change it", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const givePro = () => {
    const rs = Math.max(0, parseInt(amount, 10) || 0);
    const m: PayMethod = rs === 0 ? 'free' : method;
    run(() => admin.setPlan(user.id, 'pro', days, extend, note || (rs ? `Paid ${rupees(rs)} by ${m.toUpperCase()}` : 'Given free'), rs, m));
  };

  return (
    <Sheet visible={!!user} onClose={onClose} title={user.name || user.email || 'User'}>
      <ScrollView style={{ maxHeight: 620 }} contentContainerStyle={{ gap: 14, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 2 }}>
          <Txt size={13.5} color={C.ink2}>
            {user.email}
          </Txt>
          <Txt size={14.5} weight="heavy">
            {planText(user)}
          </Txt>
          {user.plan_note ? (
            <Txt size={12.5} color={C.ink2}>
              {user.plan_note}
            </Txt>
          ) : null}
          <Txt size={12.5} color={C.ink2}>
            Joined {day(user.created_at)} · {user.ai_calls} AI uses ({user.ai_today} today)
          </Txt>
        </View>

        <Divider />
        <Txt size={15} weight="heavy">
          Give Jugnu Pro
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {DURATIONS.map((d) => (
            <Chip key={d.days} label={d.label} on={days === d.days} onPress={() => setDays(d.days)} />
          ))}
        </View>
        {days > 0 && user.active && user.plan_until ? (
          <Toggle label="Add to the current end date" help={`Otherwise it counts from today. Now ends ${day(user.plan_until)}.`} on={extend} onChange={setExtend} />
        ) : null}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ width: 120 }}>
            <Field label="Paid (₹)" value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="0" maxLength={6} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Label>How</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {METHODS.map((m) => (
                <Chip key={m.key} label={m.label} on={method === m.key} onPress={() => setMethod(m.key)} />
              ))}
            </View>
          </View>
        </View>
        <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="UPI ref 4512…, or why it's free" />
        <Btn label={busy ? 'Saving…' : `Give Pro · ${DURATIONS.find((d) => d.days === days)?.label}`} onPress={givePro} disabled={busy} />

        <Divider />
        <Txt size={15} weight="heavy">
          Free trial / demo
        </Txt>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
          <View style={{ width: 120 }}>
            <Field label="Days" value={trialDays} onChangeText={setTrialDays} keyboardType="number-pad" maxLength={3} />
          </View>
          <Btn
            label="Give free trial"
            kind="secondary"
            style={{ flex: 1 }}
            disabled={busy}
            onPress={() => run(() => admin.setPlan(user.id, 'trial', Math.max(1, parseInt(trialDays, 10) || 30), false, `${parseInt(trialDays, 10) || 30}-day free trial (admin)`, 0, 'free'))}
          />
        </View>

        <Divider />
        <Btn
          label="Remove plan"
          kind="danger"
          disabled={busy || user.plan === 'none'}
          onPress={() =>
            Alert.alert('Remove plan?', `${user.email} loses Jugnu AI now. Alarms keep working.`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Remove', style: 'destructive', onPress: () => run(() => admin.setPlan(user.id, 'none', 0, false, 'Removed by admin', 0, null)) },
            ])
          }
        />
        {user.id !== meId ? (
          <Btn
            label={user.is_admin ? 'Remove admin access' : 'Make admin'}
            kind="ghost"
            disabled={busy}
            onPress={() =>
              Alert.alert(user.is_admin ? 'Remove admin access?' : 'Make admin?', user.is_admin ? 'They will no longer see this page.' : 'They can see every user and change plans.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Yes', onPress: () => run(() => admin.setAdmin(user.id, !user.is_admin)) },
              ])
            }
          />
        ) : null}

        {history.length > 0 ? (
          <>
            <Divider />
            <Txt size={15} weight="heavy">
              History
            </Txt>
            {history.map((h, i) => (
              <View key={i} style={{ gap: 1 }}>
                <Txt size={13.5} weight="bold">
                  {h.plan === 'none' ? 'Plan removed' : `${h.plan === 'pro' ? 'Pro' : 'Trial'}${h.plan_until ? ` until ${day(h.plan_until)}` : ' · no end'}`}
                  {h.amount ? ` · ${rupees(h.amount)} ${h.method?.toUpperCase() ?? ''}` : ''}
                </Txt>
                <Txt size={12} color={C.ink2}>
                  {day(h.created_at)}
                  {h.note ? ` · ${h.note}` : ''}
                </Txt>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}
