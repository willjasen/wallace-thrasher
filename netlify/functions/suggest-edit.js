// Netlify Function: suggest-edit
// Accepts a community suggestion, forks the repo under the contributor's GitHub
// account, and opens a PR from their fork — so the PR appears as coming from them.
//
// Required environment variables (set in Netlify dashboard + .env):
//   GITHUB_OAUTH_SECRET — shared secret for verifying and decrypting contributor
//                         identity tokens minted by github-oauth-callback.
//                         (No GITHUB_TOKEN needed — contributors supply their own token.)

'use strict';

const crypto = require('crypto');

const REPO_OWNER = 'willjasen';
const REPO_NAME  = 'wallace-thrasher';
const BASE_BRANCH = 'main';

const VALID_EDIT_TYPES = ['Speaker', 'Subtitle', 'TrackLine', 'Alias', 'Establishment'];

// Only lowercase letters, digits, and hyphens — prevents path traversal in file paths.
const SLUG_RE    = /^[a-z0-9-]{1,100}$/;
// Speaker IDs seen in the data: SPEAKER_00, LPC, etc.
const SPEAKER_RE = /^[A-Za-z0-9_ -]{1,60}$/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Derives separate signing and encryption keys from GITHUB_OAUTH_SECRET via HKDF-SHA256.
// Must match the derivation in github-oauth-callback.js exactly.
function deriveKeys(secret) {
  const ikm  = Buffer.from(secret, 'utf8');
  const salt = Buffer.from('wt-oauth-v1', 'utf8');
  return {
    sigKey: Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('sign'),    32)),
    encKey: Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('encrypt'), 32)),
  };
}

// Verifies a signed identity token minted by github-oauth-callback.
// The HMAC covers the full payload (login, exp, jti, token_enc) so no
// field can be tampered with without invalidating the signature.
// Returns the GitHub login string on success, or null if invalid/expired.
function verifyIdentity(auth) {
  if (!auth || !auth.login || !auth.exp || !auth.jti || !auth.sig || !auth.token_enc) return null;
  if (Date.now() > auth.exp) return null;
  const secret = process.env.GITHUB_OAUTH_SECRET;
  if (!secret) return null;
  try {
    const { sigKey } = deriveKeys(secret);
    const expected = crypto
      .createHmac('sha256', sigKey)
      .update(`${auth.login}|${auth.exp}|${auth.jti}|${auth.token_enc}`)
      .digest('hex');
    const sigBuf = Buffer.from(auth.sig,  'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
    return String(auth.login);
  } catch {
    return null;
  }
}

function jsonResponse(statusCode, data) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  };
}

async function githubFetch(method, path, token, body, owner, repo) {
  const res = await fetch(
    `https://api.github.com/repos/${owner || REPO_OWNER}/${repo || REPO_NAME}${path}`,
    {
      method,
      headers: {
        Authorization:          `Bearer ${token}`,
        Accept:                 'application/vnd.github+json',
        'Content-Type':         'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent':           'wallace-thrasher-suggest-edit/1.0',
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status} ${res.statusText}: ${text}`);
  }

  return res.json();
}

// Decrypts the contributor's GitHub OAuth access token from the identity payload.
// Uses the encryption key derived via HKDF — separate from the signing key.
function decryptContributorToken(auth) {
  if (!auth || !auth.token_enc) return null;
  const secret = process.env.GITHUB_OAUTH_SECRET;
  if (!secret) return null;
  try {
    const { encKey } = deriveKeys(secret);
    const [ivHex, encHex, tagHex] = String(auth.token_enc).split(':');
    if (!ivHex || !encHex || !tagHex) return null;
    const iv       = Buffer.from(ivHex,  'hex');
    const enc      = Buffer.from(encHex, 'hex');
    const tag      = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch { return null; }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  // --- Parse body ---
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const { edit_type, album_slug, track_slug, edits, new_value, note, auth, _hp } = body;

  // Honeypot: bots tend to fill hidden fields; humans don't.
  if (_hp) {
    return jsonResponse(200, { ok: true });
  }

  // --- Validate edit_type ---
  if (!VALID_EDIT_TYPES.includes(edit_type)) {
    return jsonResponse(400, { error: 'Invalid edit_type. Must be one of: ' + VALID_EDIT_TYPES.join(', ') });
  }

  // --- Validate slugs ---
  if (!album_slug || !SLUG_RE.test(album_slug)) {
    return jsonResponse(400, { error: 'Invalid album_slug' });
  }
  if (!track_slug || !SLUG_RE.test(track_slug)) {
    return jsonResponse(400, { error: 'Invalid track_slug' });
  }

  // --- Validate edits / new_value per edit type ---
  if (edit_type === 'Speaker' || edit_type === 'Subtitle') {
    // edits is an array of { index, new_value } pairs — supports bulk changes in one PR
    if (!Array.isArray(edits) || edits.length === 0 || edits.length > 500) {
      return jsonResponse(400, { error: 'edits must be a non-empty array (max 500 items) for Speaker/Subtitle edits' });
    }
    const seenIndexes = new Set();
    for (const edit of edits) {
      if (!Number.isInteger(edit.index) || edit.index < 1) {
        return jsonResponse(400, { error: 'Each edit.index must be a positive integer' });
      }
      if (seenIndexes.has(edit.index)) {
        return jsonResponse(400, { error: `Duplicate edit.index ${edit.index}` });
      }
      seenIndexes.add(edit.index);
      if (edit_type === 'Speaker') {
        if (!SPEAKER_RE.test(String(edit.new_value ?? ''))) {
          return jsonResponse(400, { error: `Invalid speaker value at index ${edit.index}` });
        }
      } else {
        if (typeof edit.new_value !== 'string' || edit.new_value.trim().length === 0 || edit.new_value.length > 1000) {
          return jsonResponse(400, { error: `new_value at index ${edit.index} must be a non-empty string (max 1000 chars)` });
        }
      }
    }
  } else if (edit_type === 'TrackLine') {
    // edits is an array of { index, speaker?, text? } — patches both fields in one commit
    if (!Array.isArray(edits) || edits.length === 0 || edits.length > 500) {
      return jsonResponse(400, { error: 'edits must be a non-empty array (max 500 items) for TrackLine edits' });
    }
    const seenIndexes = new Set();
    for (const edit of edits) {
      if (!Number.isInteger(edit.index) || edit.index < 1) {
        return jsonResponse(400, { error: 'Each edit.index must be a positive integer' });
      }
      if (seenIndexes.has(edit.index)) {
        return jsonResponse(400, { error: `Duplicate edit.index ${edit.index}` });
      }
      seenIndexes.add(edit.index);
      if (edit.speaker === undefined && edit.text === undefined) {
        return jsonResponse(400, { error: `Edit at index ${edit.index} must have at least one of 'speaker' or 'text'` });
      }
      if (edit.speaker !== undefined && !SPEAKER_RE.test(String(edit.speaker))) {
        return jsonResponse(400, { error: `Invalid speaker value at index ${edit.index}` });
      }
      if (edit.text !== undefined && (typeof edit.text !== 'string' || edit.text.trim().length === 0 || edit.text.length > 1000)) {
        return jsonResponse(400, { error: `text at index ${edit.index} must be a non-empty string (max 1000 chars)` });
      }
    }
  } else {
    // Alias or Establishment — expects an array of trimmed, non-empty strings
    if (!Array.isArray(new_value) || new_value.length > 50) {
      return jsonResponse(400, { error: `new_value must be an array (max 50 items) for ${edit_type} edits` });
    }
    for (const item of new_value) {
      if (typeof item !== 'string' || item.trim().length === 0 || item.length > 100) {
        return jsonResponse(400, { error: 'Each item must be a non-empty string (max 100 chars)' });
      }
    }
  }

  // --- Require GitHub authentication ---
  // Contributors must sign in so the PR is opened from their fork and appears as theirs.
  if (!auth) {
    return jsonResponse(401, { error: 'Please sign in with GitHub to submit a suggestion.' });
  }
  const attributedTo = verifyIdentity(auth);
  if (!attributedTo) {
    return jsonResponse(401, { error: 'Your session has expired. Please sign in again.' });
  }
  const contributorToken = decryptContributorToken(auth);
  if (!contributorToken) {
    return jsonResponse(401, { error: 'Unable to verify your session. Please sign in again.' });
  }

  // Sanitise the optional note
  const sanitisedNote = note ? String(note).slice(0, 500) : null;

  // --- GitHub operations (contributor's token does all the work) ---
  try {
    // 1. Fork the upstream repo under the contributor's account (idempotent —
    //    returns the existing fork if one already exists).
    const fork = await githubFetch('POST', '/forks', contributorToken, { default_branch_only: true });
    const forkOwner = fork.owner.login;
    const forkRepo  = fork.name;

    // 2. Resolve the base branch SHA from the upstream repo.
    const baseRef = await githubFetch('GET', `/git/ref/heads/${BASE_BRANCH}`, contributorToken);
    const baseSha = baseRef.object.sha;

    // 3. Create a unique branch on the fork (retry while the fork finishes initialising).
    const branchName = `suggest/${edit_type.toLowerCase()}-${album_slug}-${track_slug}-${Date.now()}`;
    let branchCreated = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await githubFetch('POST', '/git/refs', contributorToken, {
          ref: `refs/heads/${branchName}`,
          sha: baseSha,
        }, forkOwner, forkRepo);
        branchCreated = true;
        break;
      } catch {
        if (attempt < 4) await sleep(1500);
      }
    }
    if (!branchCreated) {
      return jsonResponse(503, { error: 'Your fork is still initialising — please try submitting again in a few seconds.' });
    }

    const editCount = (edit_type === 'Speaker' || edit_type === 'Subtitle' || edit_type === 'TrackLine') ? edits.length : null;

    // 3. Fetch the file, apply the change, and re-encode
    let filePath, newContentB64, currentSha;

    if (edit_type === 'Speaker' || edit_type === 'Subtitle') {
      filePath = `jekyll/assets/json/${album_slug}/${track_slug}.json`;

      // Fetch from upstream — fork mirrors it at baseSha, blob SHAs are identical.
      const fileData = await githubFetch(
        'GET',
        `/contents/${filePath}?ref=${encodeURIComponent(BASE_BRANCH)}`,
        contributorToken
      );
      currentSha = fileData.sha;

      const lines = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf8'));
      for (const edit of edits) {
        const entry = lines.find(e => e.Index === edit.index);
        if (!entry) {
          return jsonResponse(400, { error: `No entry with Index ${edit.index} in ${filePath}` });
        }
        if (edit_type === 'Speaker') {
          entry.Speaker = edit.new_value;
        } else {
          entry.Text = edit.new_value;
        }
      }

      newContentB64 = Buffer.from(JSON.stringify(lines, null, 2) + '\n').toString('base64');

    } else if (edit_type === 'TrackLine') {
      filePath = `jekyll/assets/json/${album_slug}/${track_slug}.json`;

      const tlFileData = await githubFetch(
        'GET',
        `/contents/${filePath}?ref=${encodeURIComponent(BASE_BRANCH)}`,
        contributorToken
      );
      currentSha = tlFileData.sha;

      const tlLines = JSON.parse(Buffer.from(tlFileData.content, 'base64').toString('utf8'));
      for (const edit of edits) {
        const entry = tlLines.find(e => e.Index === edit.index);
        if (!entry) {
          return jsonResponse(400, { error: `No entry with Index ${edit.index} in ${filePath}` });
        }
        if (edit.speaker !== undefined) entry.Speaker = edit.speaker;
        if (edit.text    !== undefined) entry.Text    = edit.text;
      }

      newContentB64 = Buffer.from(JSON.stringify(tlLines, null, 2) + '\n').toString('base64');

    } else {
      // Alias or Establishment — stored in data.json track metadata
      filePath = 'jekyll/assets/json/data.json';

      const fileData = await githubFetch(
        'GET',
        `/contents/${filePath}?ref=${encodeURIComponent(BASE_BRANCH)}`,
        contributorToken
      );
      currentSha = fileData.sha;

      const data = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf8'));
      const album = (data.Albums || []).find(a => a.Album_Slug === album_slug);
      if (!album) {
        return jsonResponse(400, { error: `Album '${album_slug}' not found in data.json` });
      }
      const track = (album.Tracks || []).find(t => t.Track_Slug === track_slug);
      if (!track) {
        return jsonResponse(400, { error: `Track '${track_slug}' not found in album '${album_slug}'` });
      }

      const key = edit_type === 'Alias' ? 'Aliases' : 'Establishments';
      track[key] = new_value.map(s => s.trim());

      newContentB64 = Buffer.from(JSON.stringify(data, null, 2) + '\n').toString('base64');
    }

    // 4. Commit the patched file to the fork's branch.
    await githubFetch('PUT', `/contents/${filePath}`, contributorToken, {
      message: `[suggestion] ${edit_type.toLowerCase()} edit${editCount !== null ? ` (${editCount} lines)` : ''}: ${track_slug} (${album_slug})`,
      content: newContentB64,
      sha:     currentSha,
      branch:  branchName,
    }, forkOwner, forkRepo);

    // 5. Open a pull request
    const prBodyLines = [
      `**Edit type:** ${edit_type}`,
      `**Album:** \`${album_slug}\``,
      `**Track:** \`${track_slug}\``,
      `**Suggested by:** [@${attributedTo}](https://github.com/${attributedTo})`,
    ];
    if (edit_type === 'Speaker' || edit_type === 'Subtitle' || edit_type === 'TrackLine') {
      if (edit_type === 'TrackLine') {
        prBodyLines.push(
          `**Changes (${edits.length} line${edits.length !== 1 ? 's' : ''}):**`,
          '',
          '| Index | Speaker | Text |',
          '|------:|---------|------|',
          ...edits.map(e =>
            `| ${e.index} | ${e.speaker !== undefined ? String(e.speaker).replace(/\|/g, '\\|') : '\u2014'} | ${e.text !== undefined ? String(e.text).replace(/\|/g, '\\|') : '\u2014'} |`
          )
        );
      } else {
        const field = edit_type === 'Speaker' ? 'Speaker' : 'Text';
        prBodyLines.push(
          `**Changes (${edits.length} line${edits.length !== 1 ? 's' : ''}):**`,
          '',
          `| Index | New ${field} |`,
          `|------:|------------|`,
          ...edits.map(e => `| ${e.index} | ${String(e.new_value).replace(/\|/g, '\\|')} |`)
        );
      }
    } else {
      prBodyLines.push(
        `**Proposed value:**\n\`\`\`\n${JSON.stringify(new_value, null, 2)}\n\`\`\``
      );
    }
    if (sanitisedNote) {
      prBodyLines.push(`**Contributor note:** ${sanitisedNote}`);
    }
    prBodyLines.push('', '_Opened automatically via the community suggestion form._');

    // 5. Open the PR on the upstream repo using the contributor's token.
    //    head uses forkOwner:branchName so the PR appears as opened by them.
    const pr = await githubFetch('POST', '/pulls', contributorToken, {
      title: `[Suggestion] ${edit_type}: ${track_slug} (${album_slug})${editCount !== null ? ` — ${editCount} line${editCount !== 1 ? 's' : ''}` : ''}`,
      body:  prBodyLines.join('\n'),
      head:  `${forkOwner}:${branchName}`,
      base:  BASE_BRANCH,
    });

    return jsonResponse(200, { ok: true, pr_url: pr.html_url, pr_number: pr.number });

  } catch (err) {
    console.error('suggest-edit function error:', err);
    return jsonResponse(500, { error: 'Failed to submit suggestion. Please try again later.' });
  }
};
