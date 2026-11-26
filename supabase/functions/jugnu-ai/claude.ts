// Claude, Jugnu AI's main provider (copied from Ginti's ai function). Gemini takes over when it can't answer.
import Anthropic from 'npm:@anthropic-ai/sdk@1.14.0';

type File = { mime: string; data: string };
type Msg = { role: 'system' | 'user' | 'assistant'; content: string; images?: string[]; files?: File[] };
export type ClaudeAnswer = { text: string; model: string } | { skip: string } | { fail: string };

const KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const MODEL = Deno.env.get('CLAUDE_MODEL') ?? 'claude-opus-5-5';
const client = KEY ? new Anthropic({ apiKey: KEY, maxRetries: 1 }) : null;

/**
 * Structured outputs need every object closed (additionalProperties: false) and nullable fields as
 * anyOf; Jugnu's schemas are plain JSON Schema, so they are adapted here.
 */
function strictSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictSchema);
  if (!node || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) out[k] = k === 'properties' ? Object.fromEntries(Object.entries(v as object).map(([p, s]) => [p, strictSchema(s)])) : strictSchema(v);
  if (Array.isArray(out.type)) {
    const types = out.type as string[];
    delete out.type;
    return { anyOf: types.map((t) => (t === 'null' ? { type: 'null' } : { ...out, type: t })) };
  }
  if (out.type === 'object') out.additionalProperties = false;
  return out;
}

export async function claude(messages: Msg[], format: Record<string, unknown> | undefined): Promise<ClaudeAnswer> {
  if (!client) return { skip: 'claude not configured' };
  const reading = messages.some((m) => m.files?.length);
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const turns: Anthropic.Beta.BetaMessageParam[] = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content:
        m.images?.length || m.files?.length
          ? [
              ...(m.files ?? []).map((f) => ({ type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: f.data } })),
              ...(m.images ?? []).map((b64) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: b64 } })),
              { type: 'text' as const, text: m.content },
            ]
          : m.content,
    }));

  try {
    // Streamed so a long statement doesn't hit the HTTP timeout; finalMessage() collects the whole reply.
    const message = await client.beta.messages
      .stream({
        model: MODEL,
        max_tokens: reading ? 64000 : 16000,
        // Quick extraction and chat run at low effort; reading a whole statement gets medium.
        output_config: { effort: reading ? 'medium' : 'low', ...(format ? { format: { type: 'json_schema', schema: strictSchema(format) as Record<string, unknown> } } : {}) },
        // A policy decline is re-run on a fallback model inside the same call instead of failing.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        ...(system ? { system } : {}),
        messages: turns,
      })
      .finalMessage();
    if (message.stop_reason === 'refusal') return { skip: `claude refused (${message.stop_details?.category ?? 'no category'})` };
    const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    return text ? { text, model: message.model } : { skip: `claude gave no text (${message.stop_reason})` };
  } catch (error) {
    // Any Claude error hands the request on to Gemini rather than failing it.
    if (error instanceof Anthropic.BadRequestError) return { skip: `claude 400: ${error.message.slice(0, 300)}` };
    if (error instanceof Anthropic.APIError) return { skip: `claude ${error.status ?? 'network'}: ${error.message.slice(0, 160)}` };
    return { skip: `claude error: ${String(error).slice(0, 160)}` };
  }
}
