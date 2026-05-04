const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

function cleanBaseUrl(value: string) {
  let sanitized = value.trim().replace(/\/$/, '');
  sanitized = sanitized.replace(/\/web\/?$/i, '');
  sanitized = sanitized.replace(/\/radarr\/?$/i, '/radarr');
  if (/^https:\/\/\d+\.\d+\.\d+\.\d+/.test(sanitized)) {
    sanitized = sanitized.replace(/^https:/, 'http:');
  }
  return sanitized;
}

function buildApiUrl(baseUrl: string, apiPath: string) {
  const path = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  return `${baseUrl}${path}`;
}

function fallbackBaseUrls(baseUrl: string) {
  const stripped = baseUrl.replace(/\/radarr$/i, '');
  return stripped === baseUrl ? [baseUrl] : [baseUrl, stripped];
}

function describeConnectionError(err: unknown, baseUrl: string) {
  if (err instanceof DOMException && err.name === 'TimeoutError') {
    return `Timed out connecting to ${baseUrl}. Make sure this Radarr URL is publicly reachable from Lovable Cloud and not only available on your home network.`;
  }
  if (err instanceof TypeError) {
    return `Could not reach ${baseUrl}. Check the URL, port forwarding, firewall, and whether Radarr is running.`;
  }
  return err instanceof Error ? err.message : 'Unknown error';
}

async function apiFetch(baseUrl: string, path: string, apiKey: string, init: RequestInit = {}) {
  const headers = { 'X-Api-Key': apiKey, 'Content-Type': 'application/json', ...(init.headers || {}) };
  let lastError: unknown;
  for (const candidate of fallbackBaseUrls(baseUrl)) {
    try {
      const res = await fetch(buildApiUrl(candidate, path), { ...init, headers, signal: AbortSignal.timeout(8000) });
      const text = await res.text();
      let data: any = null;
      if (text) {
        try { data = JSON.parse(text); } catch { data = text; }
      }
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
      return data;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function getDefaults(baseUrl: string, apiKey: string) {
  const [rootFolders, qualityProfiles] = await Promise.all([
    apiFetch(baseUrl, '/api/v3/rootfolder', apiKey),
    apiFetch(baseUrl, '/api/v3/qualityprofile', apiKey),
  ]);
  const rootFolderPath = rootFolders?.find((f: any) => f.accessible !== false)?.path || rootFolders?.[0]?.path;
  const qualityProfileId = qualityProfiles?.find((p: any) => /hd|1080|any|uhd|4k/i.test(p.name))?.id || qualityProfiles?.[0]?.id;
  if (!rootFolderPath || !qualityProfileId) {
    throw new Error('No Radarr root folder or quality profile found. Add one in Radarr first.');
  }
  return { rootFolderPath, qualityProfileId };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const RADARR_URL = Deno.env.get('RADARR_URL');
  const RADARR_API_KEY = Deno.env.get('RADARR_API_KEY');

  if (!RADARR_URL || !RADARR_API_KEY) return json({ error: 'Radarr not configured' }, 500);

  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const baseUrl = cleanBaseUrl(RADARR_URL);

  try {
    switch (action) {
      case 'status': {
        const data = await apiFetch(baseUrl, '/api/v3/system/status', RADARR_API_KEY);
        return json({ online: true, version: data.version, name: data.instanceName });
      }
      case 'movies': {
        const data = await apiFetch(baseUrl, '/api/v3/movie', RADARR_API_KEY);
        return json({ movies: data });
      }
      case 'search': {
        const term = url.searchParams.get('term')?.trim();
        if (!term) return json({ error: 'Search term required' }, 400);
        const data = await apiFetch(baseUrl, `/api/v3/movie/lookup?term=${encodeURIComponent(term)}`, RADARR_API_KEY);
        return json({ results: data });
      }
      case 'defaults': {
        return json(await getDefaults(baseUrl, RADARR_API_KEY));
      }
      case 'add': {
        const body = await req.json();
        const defaults = await getDefaults(baseUrl, RADARR_API_KEY);
        const payload = {
          ...body,
          qualityProfileId: body.qualityProfileId || defaults.qualityProfileId,
          rootFolderPath: body.rootFolderPath || defaults.rootFolderPath,
          monitored: body.monitored ?? true,
          addOptions: body.addOptions || { searchForMovie: true },
        };
        const data = await apiFetch(baseUrl, '/api/v3/movie', RADARR_API_KEY, { method: 'POST', body: JSON.stringify(payload) });
        return json(data, 201);
      }
      case 'indexers': {
        const data = await apiFetch(baseUrl, '/api/v3/indexer', RADARR_API_KEY);
        return json({ indexers: data });
      }
      default:
        return json({ error: 'Unknown action' }, 400);
    }
  } catch (err) {
    console.error('Radarr proxy error:', err);
    return json({ error: 'Failed to connect to Radarr', details: describeConnectionError(err, baseUrl), baseUrl }, 502);
  }
});
