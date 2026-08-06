// Public /token endpoint for the browser-based Stretchie caller.
exports.handler = function(context, event, callback) {
  const response = new Twilio.Response();
  const requestOrigin = event.request && event.request.headers
    ? event.request.headers.origin
    : '';
  const allowedOrigins = new Set([
    'https://stretchie.net',
    'https://www.stretchie.net',
    'https://stretchie.org',
    'https://www.stretchie.org'
  ]);
  const isLocalOrigin = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(requestOrigin);

  response.appendHeader(
    'Access-Control-Allow-Origin',
    allowedOrigins.has(requestOrigin) || isLocalOrigin ? requestOrigin : 'https://stretchie.net'
  );
  response.appendHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.appendHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.appendHeader('Cache-Control', 'no-store');

  if (event.request && event.request.method === 'OPTIONS') {
    response.setStatusCode(204);
    return callback(null, response);
  }

  if (!context.TWILIO_API_KEY || !context.TWILIO_API_SECRET || !context.TWIML_APP_SID) {
    response.setStatusCode(500);
    response.appendHeader('Content-Type', 'application/json');
    response.setBody({ error: 'Browser calling is not configured.' });
    return callback(null, response);
  }

  const requestedIdentity = String(event.identity || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  const identity = requestedIdentity || `stretchie-web-${Date.now().toString(36)}`;
  const AccessToken = Twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;
  const token = new AccessToken(
    context.ACCOUNT_SID,
    context.TWILIO_API_KEY,
    context.TWILIO_API_SECRET,
    { identity, ttl: 600 }
  );

  token.addGrant(new VoiceGrant({
    outgoingApplicationSid: context.TWIML_APP_SID
  }));

  response.appendHeader('Content-Type', 'application/json');
  response.setBody({ token: token.toJwt() });
  return callback(null, response);
};
