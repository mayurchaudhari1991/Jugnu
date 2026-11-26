// Jugnu AI: reads a prescription photo into medicines and times, or turns a typed sentence into a
// reminder. Needs an active plan (free trial or Pro, set by the admin) and stays under a daily limit
// (jugnu_settings.daily_limit). Uses Claude (claude.ts), and Gemini when Claude can't answer.
// The API keys live in Supabase secrets and never reach the phone.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { claude } from './claude.ts';

type Msg = { role: 'system' | 'user' | 'assistant'; content: string; images?: string[] };
type Answer = { text: string; model: string } | { skip: string } | { fail: string };
type Body = { feature?: 'scan' | 'parse'; images?: string[]; text?: string; now?: string };

const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODELS = (Deno.env.get('GEMINI_MODELS') ?? 'gemini-3.5-flash-lite,gemini-3.1-flash-lite').split(',').map((m) => m.trim());
const RETRYABLE = [401, 402, 403, 404, 408, 429, 500, 502, 503, 504];
const TIMEOUT = 60000;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

// ---------------------------------------------------------------- prompts and output shapes

const SCAN_SYSTEM = `You read doctors' prescriptions from photos (often handwritten, often Indian) and list every medicine for a reminder app.
Rules:
- Copy medicine names exactly as written; never invent a medicine. If a word is unreadable, give your best reading and set confidence below 0.5.
- Decode dosing shorthand: OD/QD = once a day, BD/BID = twice, TDS/TID = three times, QID = four times, HS = at bedtime, SOS/PRN = only when needed, AC = before food, PC = after food, "1-0-1" = morning and night, "1-1-1" = morning, afternoon, night, "0-0-1" = night.
- times uses only: morning, afternoon, evening, night. Three times a day = morning, afternoon, night. Four times = all four.
- perDay is how many times a day. For SOS/when-needed medicines set perDay 0 and times [].
- dose is the amount per time in plain words, e.g. "1 tablet", "5 ml", "2 drops on the tongue".
- form is one of: tablet, capsule, pills, drops, syrup, powder, cream, inhaler, injection, hair, other.
- food is one of: before, after, with, any.
- days is the course length in days if written, else null.
- notes: any other instruction for that medicine, in short plain English (e.g. "with warm water", "suck slowly").
- warnings: short notes for the user about anything unclear or important (unreadable words, doses that look unusual, missing timing). Never give medical advice.
- If the photo is not a prescription, return no items and one warning saying so.`;

const SCAN_FORMAT = {
  type: 'object',
  properties: {
    doctor: { type: ['string', 'null'] },
    date: { type: ['string', 'null'] },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          dose: { type: 'string' },
          form: { type: 'string' },
          perDay: { type: 'integer' },
          times: { type: 'array', items: { type: 'string' } },
          food: { type: 'string' },
          days: { type: ['integer', 'null'] },
          notes: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['name', 'dose', 'form', 'perDay', 'times', 'food', 'days', 'notes', 'confidence'],
      },
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['doctor', 'date', 'items', 'warnings'],
};

const PARSE_SYSTEM = `You turn one sentence (English, Hindi or Hinglish) into a reminder for an alarm app.
- title: short name of the reminder, e.g. "Pay electricity bill".
- detail: what to do, if the sentence says more; else "".
- time: 24-hour "HH:MM". If no time is given pick a sensible one (morning things 09:00, evening 19:00).
- repeat.type: daily, weekly, monthly, yearly or once.
  weekly: days = list of weekday numbers, 0 = Sunday … 6 = Saturday.
  monthly: day = 1…31. yearly: month = 1…12 and day. once: date = "YYYY-MM-DD" (use today's date given below if they say "today", tomorrow's for "tomorrow").
  Unused fields are null.
- icon: one of task, gym, water, bill, book, phone, walk, cake, bell, pills.`;

const PARSE_FORMAT = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    detail: { type: 'string' },
    time: { type: 'string' },
    icon: { type: 'string' },
    repeat: {
      type: 'object',
      properties: {
        type: { type: 'string' },
        days: { type: ['array', 'null'], items: { type: 'integer' } },
        day: { type: ['integer', 'null'] },
        month: { type: ['integer', 'null'] },
        date: { type: ['string', 'null'] },
      },
      required: ['type', 'days', 'day', 'month', 'date'],
    },
  },
  required: ['title', 'detail', 'time', 'icon', 'repeat'],
};

// ---------------------------------------------------------------- providers

async function gemini(messages: Msg[], format: Record<string, unknown>): Promise<Answer> {
  if (!GEMINI_KEY) return { skip: 'gemini not configured' };
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }, ...(m.images ?? []).map((b64) => ({ inline_data: { mime_type: 'image/jpeg', data: b64 } }))],
    }));
  const request = JSON.stringify({
    contents,
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json', responseJsonSchema: format },
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
  });
  let last = '';
  for (const model of GEMINI_MODELS) {
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
        body: request,
        signal: AbortSignal.timeout(TIMEOUT),
      });
    } catch {
      last = `${model} timed out`;
      continue;
    }
    if (RETRYABLE.includes(res.status)) {
      last = `${model} ${res.status}`;
      continue;
    }
    if (!res.ok) return { fail: `Gemini ${res.status}: ${(await res.text()).slice(0, 300)}` };
    const out = await res.json();
    const text = (out.candidates?.[0]?.content?.parts ?? [])
      .filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought)
      .map((p: { text: string }) => p.text)
      .join('');
    if (text) return { text, model };
    last = `${model} gave no text`;
  }
  return { skip: last };
}

/** Pulls the JSON object out of a reply that may be wrapped in a code fence. */
function parseJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  return JSON.parse(start >= 0 && end > start ? t.slice(start, end + 1) : t);
}

async function ask(messages: Msg[], format: Record<string, unknown>) {
  const notes: string[] = [];
  for (const provider of [claude, gemini]) {
    const a = await provider(messages, format);
    if ('text' in a) {
      try {
        return { data: parseJson(a.text), model: a.model, notes };
      } catch {
        notes.push(`${a.model} sent unreadable JSON`);
        continue;
      }
    }
    notes.push('skip' in a ? a.skip : a.fail);
  }
  return { data: null, model: null, notes };
}

// ---------------------------------------------------------------- handler

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ error: 'Please sign in to use Jugnu AI.' }, 401);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Bad request' }, 400);
  }
  const feature = body.feature;
  if (feature !== 'scan' && feature !== 'parse') return json({ error: 'Unknown feature' }, 400);
  if (feature === 'scan' && !(body.images?.length && body.images.length <= 4)) return json({ error: 'Send 1 to 4 photos.' }, 400);
  if (feature === 'parse' && !(body.text && body.text.trim().length > 2 && body.text.length < 500)) return json({ error: 'Type what to remind you about.' }, 400);

  const label = feature === 'scan' ? 'Prescription scan' : 'Reminder from text';
  const { data: access, error: accessError } = await admin.rpc('jugnu_ai_check', { p_user: user.id });
  if (accessError) return json({ error: 'Could not check your plan. Try again.' }, 500);
  if (access !== 'ok') {
    const why: Record<string, string> = {
      no_plan: 'Jugnu AI needs a plan. Ask for Jugnu Pro in Settings → Account.',
      expired: 'Your Jugnu plan has ended. Renew it in Settings → Account to keep using Jugnu AI.',
      limit: "You've reached today's Jugnu AI limit. It resets in 24 hours.",
    };
    return json({ error: why[access] ?? 'Jugnu AI is not available on your account.', code: access }, 402);
  }

  const started = Date.now();
  const messages: Msg[] =
    feature === 'scan'
      ? [
          { role: 'system', content: SCAN_SYSTEM },
          { role: 'user', content: 'Read this prescription and list every medicine.', images: body.images },
        ]
      : [
          { role: 'system', content: PARSE_SYSTEM },
          { role: 'user', content: `Today is ${body.now ?? new Date().toISOString()}.\nReminder: ${body.text}` },
        ];
  const result = await ask(messages, feature === 'scan' ? SCAN_FORMAT : PARSE_FORMAT);
  const ms = Date.now() - started;

  if (!result.data) {
    await admin.from('jugnu_ai_usage').insert({ user_id: user.id, feature, ok: false, ms, error: `${label}: ${result.notes.join(' | ')}`.slice(0, 900) });
    return json({ error: 'Jugnu AI is busy right now. Please try again in a minute (this one did not count).' }, 503);
  }
  await admin.from('jugnu_ai_usage').insert({ user_id: user.id, feature, ok: true, model: result.model, ms });
  return json({ ok: true, result: result.data, model: result.model });
});
