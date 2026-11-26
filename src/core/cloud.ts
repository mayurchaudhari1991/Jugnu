// Jugnu's online part: Google sign-in, the user's plan (free trial / Pro), Jugnu AI and the admin tools.
// Plans are given by hand from the admin screen after payment by UPI or cash.
// Alarms and routines never need it: everything else in the app works offline and without an account.
import 'expo-sqlite/localStorage/install';

import { createClient, type Session } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import { AppState } from 'react-native';
import { create } from 'zustand';

const URL_ = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
/** False in builds made without the Supabase settings (.env.local). */
export const cloudConfigured = URL_.startsWith('https://') && KEY.length > 20;
const REDIRECT = 'jugnu://auth-callback';

export const supabase = createClient(URL_ || 'https://placeholder.supabase.co', KEY || 'placeholder', {
  auth: {
    storage: globalThis.localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

AppState.addEventListener('change', (s) => {
  if (s === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

export type Profile = {
  id: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
  plan: 'none' | 'trial' | 'pro';
  /** ISO date the plan ends; null with 'pro' = no end date. */
  plan_until: string | null;
  plan_note: string | null;
  is_admin: boolean;
};

/** True while the plan gives access to Jugnu AI. */
export function planActive(p: Pick<Profile, 'plan' | 'plan_until'> | null | undefined, now = Date.now()) {
  if (!p || p.plan === 'none') return false;
  return !p.plan_until || new Date(p.plan_until).getTime() > now;
}

/** "Pro until 26 Dec 2026", "Free trial · 12 days left", "No plan"… */
export function planText(p: Pick<Profile, 'plan' | 'plan_until'> | null | undefined, now = Date.now()) {
  if (!p || p.plan === 'none') return 'No plan';
  const name = p.plan === 'pro' ? 'Jugnu Pro' : 'Free trial';
  if (!p.plan_until) return `${name} · no end date`;
  const end = new Date(p.plan_until);
  const days = Math.ceil((end.getTime() - now) / 86400000);
  if (days <= 0) return `${name} ended ${end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  if (days <= 31) return `${name} · ${days} day${days === 1 ? '' : 's'} left`;
  return `${name} until ${end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

type Account = {
  session: Session | null;
  profile: Profile | null;
  ready: boolean;
  busy: boolean;
  error: string | null;
};

export const useAccount = create<Account>(() => ({ session: null, profile: null, ready: !cloudConfigured, busy: false, error: null }));

/** Fetches (and on first sign-in creates, with the free trial) the user's profile and plan. */
export async function refreshProfile() {
  if (!useAccount.getState().session) return;
  const { data, error } = await supabase.rpc('jugnu_me');
  if (error) {
    useAccount.setState({ error: friendly(error.message) });
    return;
  }
  useAccount.setState({ profile: data as Profile, error: null });
}

let started = false;
/** Call once at app start. */
export function startAccount() {
  if (started || !cloudConfigured) return;
  started = true;
  supabase.auth.getSession().then(({ data }) => {
    useAccount.setState({ session: data.session, ready: true });
    if (data.session) refreshProfile();
  });
  supabase.auth.onAuthStateChange((_e, session) => {
    const had = useAccount.getState().session?.user.id;
    useAccount.setState({ session, ...(session ? {} : { profile: null }) });
    if (session && session.user.id !== had) refreshProfile();
  });
}

function friendly(message: string) {
  if (/network|fetch/i.test(message)) return 'No internet connection. Try again when you are online.';
  if (/provider is not enabled|Unsupported provider/i.test(message)) return 'Google sign-in is not switched on for Jugnu yet.';
  if (/jugnu_me|does not exist/i.test(message)) return 'Jugnu accounts are not set up on the server yet.';
  return message;
}

/** Opens Google's account picker in a browser tab and signs in with the result. */
export async function signInWithGoogle(): Promise<boolean> {
  if (!cloudConfigured) {
    useAccount.setState({ error: 'This build of Jugnu has no online account support.' });
    return false;
  }
  useAccount.setState({ busy: true, error: null });
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: REDIRECT, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
    });
    if (error || !data?.url) throw error ?? new Error('Could not start Google sign-in.');
    const res = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT);
    if (res.type !== 'success') return false;
    const url = new URL(res.url.replace('jugnu://', 'https://jugnu.app/'));
    const failed = url.searchParams.get('error_description') ?? new URLSearchParams(url.hash.slice(1)).get('error_description');
    if (failed) throw new Error(failed.replace(/\+/g, ' '));
    const code = url.searchParams.get('code');
    if (!code) throw new Error('Google sign-in did not finish. Please try again.');
    const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
    if (exErr) throw exErr;
    await refreshProfile();
    return true;
  } catch (e) {
    useAccount.setState({ error: friendly(e instanceof Error ? e.message : String(e)) });
    return false;
  } finally {
    useAccount.setState({ busy: false });
  }
}

export async function signOut() {
  await supabase.auth.signOut();
  useAccount.setState({ profile: null, session: null });
}

// ---------------------------------------------------------------- Jugnu AI

export type ScanItem = {
  name: string;
  dose: string;
  form: string;
  perDay: number;
  times: ('morning' | 'afternoon' | 'evening' | 'night')[];
  food: 'before' | 'after' | 'with' | 'any';
  days: number | null;
  notes: string;
  confidence: number;
};
export type ScanResult = { doctor: string | null; date: string | null; items: ScanItem[]; warnings: string[] };

export type ParsedReminder = {
  title: string;
  detail: string;
  time: string;
  icon: string;
  repeat: { type: string; days: number[] | null; day: number | null; month: number | null; date: string | null };
};

export class AiError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

async function callAi<T>(body: Record<string, unknown>): Promise<T> {
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) throw new AiError('Please sign in first.', 'auth');
  let res: Response;
  try {
    res = await fetch(`${URL_}/functions/v1/jugnu-ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session.access_token}`, apikey: KEY },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AiError('No internet connection. Try again when you are online.');
  }
  const out = await res.json().catch(() => ({}));
  if (out.code === 'expired' || out.code === 'no_plan') refreshProfile();
  if (!res.ok || !out.ok) throw new AiError(out.error ?? `Jugnu AI failed (${res.status}).`, out.code);
  return out.result as T;
}

export const scanPrescription = (images: string[]) => callAi<ScanResult>({ feature: 'scan', images });
export const parseReminder = (text: string) => callAi<ParsedReminder>({ feature: 'parse', text, now: new Date().toString() });

// ---------------------------------------------------------------- admin

export type AdminUser = {
  id: string;
  email: string | null;
  name: string | null;
  plan: Profile['plan'];
  plan_until: string | null;
  plan_note: string | null;
  active: boolean;
  is_admin: boolean;
  created_at: string;
  last_seen: string;
  ai_calls: number;
  ai_today: number;
};
export type AdminStats = {
  users: number;
  users_7d: number;
  pro: number;
  trials: number;
  expiring_7d: number;
  ai_today: number;
  ai_30d: number;
  failures_today: number;
  earned_30d: number;
  earned_total: number;
};
export type PlanChange = {
  plan: Profile['plan'];
  plan_until: string | null;
  note: string | null;
  amount: number;
  method: string | null;
  created_at: string;
};
export type PayMethod = 'upi' | 'cash' | 'free' | 'other';

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(friendly(r.error.message));
  return r.data as T;
}

export const admin = {
  users: async (search = '') => must<AdminUser[]>(await supabase.rpc('jugnu_admin_users', { p_search: search })),
  stats: async () => must<AdminStats[]>(await supabase.rpc('jugnu_admin_stats'))[0],
  /** days > 0: that many days (added to the current end when extend); days 0 with 'pro': no end date. */
  setPlan: async (userId: string, plan: Profile['plan'], days: number, extend: boolean, note: string, amount: number, method: PayMethod | null) =>
    must<Profile>(
      await supabase.rpc('jugnu_admin_set_plan', { p_user: userId, p_plan: plan, p_days: days, p_extend: extend, p_note: note, p_amount: amount, p_method: method }),
    ),
  setAdmin: async (userId: string, on: boolean) => must(await supabase.rpc('jugnu_admin_set_admin', { p_user: userId, p_admin: on })),
  settings: async () => Object.fromEntries(must<{ key: string; value: string }[]>(await supabase.from('jugnu_settings').select('key, value')).map((r) => [r.key, r.value])),
  setSetting: async (key: 'trial_days' | 'daily_limit', value: string) => must(await supabase.rpc('jugnu_admin_set_setting', { p_key: key, p_value: value })),
  history: async (userId: string) =>
    must<PlanChange[]>(
      await supabase.from('jugnu_plan_log').select('plan, plan_until, note, amount, method, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(30),
    ),
};
