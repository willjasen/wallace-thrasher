// Netlify Function: github-oauth-callback
// Handles the GitHub OAuth authorization callback.
// Exchanges the temporary code for a GitHub access token, fetches the
// authenticated user's public profile, then mints a short-lived signed
// identity token and redirects back to the track page.
//
// Required environment variables (set in Netlify dashboard + .env):
//   GITHUB_CLIENT_ID     — OAuth App client ID (public value)
//   GITHUB_CLIENT_SECRET — OAuth App client secret (keep private)
//   GITHUB_OAUTH_SECRET  — Random secret for signing identity tokens (keep private)

'use strict';

const crypto = require('crypto');

// Identity token validity — 4 hours.
const TOKEN_TTL_MS = 4 * 60 * 60 * 1000;

// Derives separate signing and encryption keys from GITHUB_OAUTH_SECRET via HKDF-SHA256.
// Using separate keys prevents cross-use between the MAC and the cipher.
function deriveKeys(secret) {
  const ikm  = Buffer.from(secret, 'utf8');
  const salt = Buffer.from('wt-oauth-v1', 'utf8');
  return {
    sigKey: Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('sign'),    32)),
    encKey: Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('encrypt'), 32)),
  };
}

// AES-256-GCM encrypt with a random 96-bit nonce.
// Returns "ivHex:ciphertextHex:tagHex".
function encryptToken(plaintext, encKey) {
  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
  const enc    = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return `${iv.toString('hex')}:${enc.toString('hex')}:${tag.toString('hex')}`;
}

exports.handler = async (event) => {
  const q    = event.queryStringParameters || {};
  const code = q.code;
  const state = q.state;

  const clientId     = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const oauthSecret  = process.env.GITHUB_OAUTH_SECRET;

  if (!clientId || !clientSecret || !oauthSecret) {
    console.error('github-oauth-callback: missing required environment variables');
    return redirect('/#wt-auth-error=config_error');
  }

  // --- Parse state → returnUrl (relative path only, prevents open redirect) ---
  let returnUrl = '/';
  try {
    const parsed = JSON.parse(decodeURIComponent(state || ''));
    const url = parsed.returnUrl;
    if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')) {
      returnUrl = url;
    }
  } catch { /* use default */ }

  if (!code) {
    return redirect(returnUrl + '#wt-auth-error=no_code');
  }

  // --- Exchange code for GitHub access token ---
  let accessToken;
  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept:         'application/json',
        'Content-Type': 'application/json',
        'User-Agent':   'wallace-thrasher-oauth/1.0',
      },
      body: JSON.stringify({
        client_id:     clientId,
        client_secret: clientSecret,
        code,
      }),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error || !tokenData.access_token) {
      console.error('github-oauth-callback: token exchange failed:', tokenData.error_description || tokenData.error);
      return redirect(returnUrl + '#wt-auth-error=token_exchange_failed');
    }
    accessToken = tokenData.access_token;
  } catch (err) {
    console.error('github-oauth-callback: token exchange error:', err);
    return redirect(returnUrl + '#wt-auth-error=token_exchange_failed');
  }

  // --- Fetch the authenticated user's public profile ---
  let user;
  try {
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization:          `Bearer ${accessToken}`,
        Accept:                 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent':           'wallace-thrasher-oauth/1.0',
      },
    });
    user = await userRes.json();
    if (!user.login) throw new Error('No login in user response');
  } catch (err) {
    console.error('github-oauth-callback: user fetch error:', err);
    return redirect(returnUrl + '#wt-auth-error=user_fetch_failed');
  }

  // --- Mint a short-lived, fully-authenticated identity token ---
  // - Separate HKDF-derived keys for signing vs. encryption.
  // - jti makes each token unique.
  // - HMAC covers all fields including token_enc, so no field can be swapped
  //   without invalidating the signature.
  const { sigKey, encKey } = deriveKeys(oauthSecret);

  const exp       = Date.now() + TOKEN_TTL_MS;
  const jti       = crypto.randomBytes(16).toString('hex');
  const token_enc = encryptToken(accessToken, encKey);

  const sig = crypto
    .createHmac('sha256', sigKey)
    .update(`${user.login}|${exp}|${jti}|${token_enc}`)
    .digest('hex');

  const identity = encodeURIComponent(JSON.stringify({
    login:      user.login,
    name:       user.name || user.login,
    avatar_url: user.avatar_url,
    exp,
    jti,
    sig,
    token_enc,
  }));

  return redirect(returnUrl + '#wt-identity=' + identity);
};

function redirect(location) {
  return { statusCode: 302, headers: { Location: location }, body: '' };
}
