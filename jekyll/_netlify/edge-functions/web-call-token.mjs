// Same-origin gateway for browser-based Stretchie Voice tokens.
// Netlify supplies the trusted client IP through context.ip.

export default async function handler(request, context) {
  if (request.method !== 'GET') {
    return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  }

  const hostname = new URL(request.url).hostname.toLowerCase();
  if (hostname !== 'stretchie.net' && hostname !== 'www.stretchie.net') {
    return Response.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const proxySecret = Netlify.env.get('WEB_CALL_PROXY_SECRET');
  const requestedIdentity = new URL(request.url).searchParams.get('identity') || '';

  if (!proxySecret) {
    return Response.json({ error: 'Browser calling is not configured.' }, { status: 503 });
  }

  if (!/^stretchie-web-[A-Za-z0-9_-]{1,48}$/.test(requestedIdentity)) {
    return Response.json({ error: 'Invalid browser identity.' }, { status: 400 });
  }

  const tokenResponse = await fetch('https://stretchie-hotline-9504.twil.io/token', {
    headers: {
      Authorization: `Bearer ${proxySecret}`,
      'X-Web-Caller-Identity': requestedIdentity,
      Origin: 'https://stretchie.net'
    }
  });

  return new Response(await tokenResponse.text(), {
    status: tokenResponse.status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

export const config = {
  path: '/api/web-call-token',
  rateLimit: {
    windowLimit: 3,
    windowSize: 60,
    aggregateBy: ['ip']
  }
};
