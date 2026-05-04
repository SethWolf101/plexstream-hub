const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

function cleanBaseUrl(value: string, appName?: string) {
  let sanitized = value.trim().replace(/\/$/, '');
  sanitized = sanitized.replace(/\/web\/?$/i, '');
  if (appName) sanitized = sanitized.replace(new RegExp(`/${appName}/?$`, 'i'), '');
  if (/^https:\/\/\d+\.\d+\.\d+\.\d+/.test(sanitized)) sanitized = sanitized.replace(/^https:/, 'http:');
  return sanitized;
}

function buildApiUrl(baseUrl: string, apiPath: string) {
  const path = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  return `${baseUrl}${path}`;
}

function describeConnectionError(err: unknown, baseUrl: string) {
  if (err instanceof DOMException && err.name === 'TimeoutError') {
    return `Timed out connecting to ${baseUrl}. Make sure this Prowlarr URL is publicly reachable from Lovable Cloud and not only available on your home network.`;
  }
  if (err instanceof TypeError) {
    return `Could not reach ${baseUrl}. Check the URL, port forwarding, firewall, and whether Prowlarr is running.`;
  }
  return err instanceof Error ? err.message : 'Unknown error';
}

async function apiFetch(baseUrl: string, path: string, apiKey: string, init: RequestInit = {}) {
  const headers = { 'X-Api-Key': apiKey, 'Content-Type': 'application/json', ...(init.headers || {}) };
  const res = await fetch(buildApiUrl(baseUrl, path), { ...init, headers, signal: AbortSignal.timeout(8000) });
  const text = await res.text();
  let data: any = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const PROWLARR_URL = Deno.env.get('PROWLARR_URL');
  const PROWLARR_API_KEY = Deno.env.get('PROWLARR_API_KEY');
  const SONARR_URL = Deno.env.get('SONARR_URL');
  const SONARR_API_KEY = Deno.env.get('SONARR_API_KEY');
  const RADARR_URL = Deno.env.get('RADARR_URL');
  const RADARR_API_KEY = Deno.env.get('RADARR_API_KEY');

  if (!PROWLARR_URL || !PROWLARR_API_KEY) return json({ error: 'Prowlarr not configured' }, 500);

  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const baseUrl = cleanBaseUrl(PROWLARR_URL, 'prowlarr');

  try {
    switch (action) {
      case 'status': {
        const data = await apiFetch(baseUrl, '/api/v1/system/status', PROWLARR_API_KEY);
        return json({ online: true, version: data.version, name: data.instanceName });
      }
      case 'indexers': {
        const data = await apiFetch(baseUrl, '/api/v1/indexer', PROWLARR_API_KEY);
        return json({ indexers: data });
      }
      case 'applications': {
        const data = await apiFetch(baseUrl, '/api/v1/applications', PROWLARR_API_KEY);
        return json({ applications: data });
      }
      case 'sync-indexers': {
        const [indexers, command] = await Promise.all([
          apiFetch(baseUrl, '/api/v1/indexer', PROWLARR_API_KEY),
          apiFetch(baseUrl, '/api/v1/command', PROWLARR_API_KEY, { method: 'POST', body: JSON.stringify({ name: 'ApplicationIndexerSync' }) })
            .catch(() => apiFetch(baseUrl, '/api/v1/command', PROWLARR_API_KEY, { method: 'POST', body: JSON.stringify({ name: 'AppIndexerSync' }) })),
        ]);

        const appChecks: Record<string, boolean> = {};
        if (SONARR_URL && SONARR_API_KEY) {
          await apiFetch(cleanBaseUrl(SONARR_URL, 'sonarr'), '/api/v3/system/status', SONARR_API_KEY);
          appChecks.sonarr = true;
        }
        if (RADARR_URL && RADARR_API_KEY) {
          await apiFetch(cleanBaseUrl(RADARR_URL, 'radarr'), '/api/v3/system/status', RADARR_API_KEY);
          appChecks.radarr = true;
        }

        return json({ count: indexers.length, synced: true, commandId: command?.id, apps: appChecks });
      }
      default:
        return json({ error: 'Unknown action' }, 400);
    }
  } catch (err) {
    console.error('Prowlarr proxy error:', err);
    return json({ error: 'Failed to connect to Prowlarr', details: describeConnectionError(err, baseUrl), baseUrl }, 502);
  }
});
