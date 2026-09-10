// Netlify Function: ai-track-review
// Reviews a track transcript and returns proposed, user-reviewable edits.

'use strict';

const crypto = require('crypto');

function jsonResponse(statusCode, data) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(data),
  };
}

function verifyIdentity(auth) {
  if (!auth || !auth.login || !auth.exp || !auth.jti || !auth.sig || !auth.token_enc) return false;
  if (Date.now() > auth.exp || !process.env.GITHUB_OAUTH_SECRET) return false;
  try {
    const ikm = Buffer.from(process.env.GITHUB_OAUTH_SECRET, 'utf8');
    const sigKey = Buffer.from(crypto.hkdfSync(
      'sha256', ikm, Buffer.from('wt-oauth-v1', 'utf8'), Buffer.from('sign'), 32
    ));
    const expected = crypto.createHmac('sha256', sigKey)
      .update(`${auth.login}|${auth.exp}|${auth.jti}|${auth.token_enc}`)
      .digest('hex');
    const actualBuffer = Buffer.from(auth.sig, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    return actualBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(actualBuffer, expectedBuffer);
  } catch (_) {
    return false;
  }
}

function validLine(line) {
  return line && Number.isInteger(line.index) && line.index > 0 &&
    typeof line.speaker === 'string' && line.speaker.length > 0 && line.speaker.length <= 100 &&
    typeof line.text === 'string' && line.text.length > 0 && line.text.length <= 1000;
}

function extractOutputText(response) {
  for (const item of response.output || []) {
    if (item.type !== 'message') continue;
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) return content.text;
    }
  }
  return '';
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_) {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  if (!verifyIdentity(body.auth)) {
    return jsonResponse(401, { error: 'Please sign in with GitHub before using AI review.' });
  }
  if (!process.env.OPENAI_API_KEY) {
    return jsonResponse(503, { error: 'AI review is not configured yet.' });
  }
  if (!Array.isArray(body.lines) || body.lines.length === 0 || body.lines.length > 500 ||
      !body.lines.every(validLine)) {
    return jsonResponse(400, { error: 'Invalid track transcript.' });
  }
  const instruction = typeof body.instruction === 'string' ? body.instruction.trim() : '';
  if (instruction.length > 500) return jsonResponse(400, { error: 'AI instruction is too long.' });

  const transcriptByIndex = new Map(body.lines.map(line => [line.index, line]));
  const prompt = [
    'Review this Longmont Potion Castle track transcript as a careful catalog editor.',
    'Propose only high-confidence corrections. Preserve jokes, unusual wording, punctuation, and speaker names unless the transcript itself supports a correction.',
    'For speaker-name consistency, use dialogue and nearby context. Never invent a real identity.',
    instruction ? `Editor request: ${instruction}` : 'Editor request: Find inconsistent speaker labels and obvious transcription errors.',
    'Return an empty edits array when no high-confidence changes are warranted.',
    '',
    JSON.stringify(body.lines),
  ].join('\n');

  let apiResponse;
  try {
    apiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5-mini',
        store: false,
        input: prompt,
        text: {
          format: {
            type: 'json_schema',
            name: 'track_review',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                summary: { type: 'string' },
                edits: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      index: { type: 'integer' },
                      speaker: { type: ['string', 'null'] },
                      text: { type: ['string', 'null'] },
                      reason: { type: 'string' },
                    },
                    required: ['index', 'speaker', 'text', 'reason'],
                  },
                },
              },
              required: ['summary', 'edits'],
            },
          },
        },
      }),
    });
  } catch (_) {
    return jsonResponse(502, { error: 'AI review is temporarily unavailable.' });
  }

  if (!apiResponse.ok) {
    console.error('OpenAI API error', apiResponse.status, await apiResponse.text());
    return jsonResponse(502, { error: 'AI review could not be completed.' });
  }

  try {
    const parsed = JSON.parse(extractOutputText(await apiResponse.json()));
    const edits = (parsed.edits || []).filter(edit => {
      const original = transcriptByIndex.get(edit.index);
      if (!original || typeof edit.reason !== 'string') return false;
      if (edit.speaker !== null && (typeof edit.speaker !== 'string' || !edit.speaker.trim() || edit.speaker.length > 100)) return false;
      if (edit.text !== null && (typeof edit.text !== 'string' || !edit.text.trim() || edit.text.length > 1000)) return false;
      return (edit.speaker !== null && edit.speaker !== original.speaker) ||
        (edit.text !== null && edit.text !== original.text);
    });
    return jsonResponse(200, { ok: true, summary: parsed.summary, edits });
  } catch (error) {
    console.error('Invalid AI review response', error);
    return jsonResponse(502, { error: 'AI review returned an invalid result.' });
  }
};

exports.verifyIdentity = verifyIdentity;
exports.extractOutputText = extractOutputText;
