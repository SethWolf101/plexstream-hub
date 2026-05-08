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
  sanitized = sanitized.replace(/\/sonarr\/?$/i, '/sonarr');
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
  const stripped = baseUrl.replace(/\/sonarr$/i, '');
  return stripped === baseUrl ? [baseUrl] : [baseUrl, stripped];
}

function describeConnectionError(err: unknown, baseUrl: string) {
  if (err instanceof DOMException && err.name === 'TimeoutError') {
    return `Timed out connecting to ${baseUrl}. Make sure this Sonarr URL is publicly reachable from Lovable Cloud and not only available on your home network.`;
  }
  if (err instanceof TypeError) {
    return `Could not reach ${baseUrl}. Check the URL, port forwarding, firewall, and whether Sonarr is running.`;
  }
  return err instanceof Error ? err.message : 'Unknown error';
}

function offlineResponse(err: unknown, baseUrl: string, action: string | null) {
  const details = describeConnectionError(err, baseUrl);
  const base = { online: false, error: 'Sonarr is offline or unreachable', details, baseUrl };
  switch (action) {
    case 'status': return json(base);
    case 'series': return json({ ...base, series: [] });
    case 'search': return json({ ...base, results: [] });
    case 'indexers': return json({ ...base, indexers: [] });
    default: return json(base);
  }
}

async function getSavedServiceConfig(serviceName: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return null;

  const res = await fetch(`${supabaseUrl}/rest/v1/service_configs?select=base_url,api_key&service_name=eq.${encodeURIComponent(serviceName)}&limit=1`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const rows = await res.json().catch(() => []);
  return rows?.[0] || null;
}

async function getServiceConfig() {
  const saved = await getSavedServiceConfig('sonarr');
  const baseUrl = saved?.base_url?.trim() || Deno.env.get('SONARR_URL') || '';
  const apiKey = saved?.api_key?.trim() || Deno.env.get('SONARR_API_KEY') || '';
  return baseUrl && apiKey ? { baseUrl, apiKey } : null;
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
  const qualityProfileId = qualityProfiles?.find((p: any) => /hd|1080|any/i.test(p.name))?.id || qualityProfiles?.[0]?.id;
  if (!rootFolderPath || !qualityProfileId) {
    throw new Error('No Sonarr root folder or quality profile found. Add one in Sonarr first.');
  }
  return { rootFolderPath, qualityProfileId };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const config = await getServiceConfig();
  if (!config) return offlineResponse(new Error('Sonarr not configured. Add the URL and API key in Admin > Services.'), 'Not configured', action);

  const baseUrl = cleanBaseUrl(config.baseUrl);
  const SONARR_API_KEY = config.apiKey;

  try {
    switch (action) {
      case 'status': {
        const data = await apiFetch(baseUrl, '/api/v3/system/status', SONARR_API_KEY);
        return json({ online: true, version: data.version, name: data.instanceName });
      }
      case 'series': {
        const data = await apiFetch(baseUrl, '/api/v3/series', SONARR_API_KEY);
        return json({ series: data });
      }
      case 'search': {
        const term = url.searchParams.get('term')?.trim();
        if (!term) return json({ error: 'Search term required' }, 400);
        const data = await apiFetch(baseUrl, `/api/v3/series/lookup?term=${encodeURIComponent(term)}`, SONARR_API_KEY);
        return json({ results: data });
      }
      case 'defaults': {
        return json(await getDefaults(baseUrl, SONARR_API_KEY));
      }
      case 'add': {
        const body = await req.json();
        const defaults = await getDefaults(baseUrl, SONARR_API_KEY);
        const payload = {
          ...body,
          qualityProfileId: body.qualityProfileId || defaults.qualityProfileId,
          rootFolderPath: body.rootFolderPath || defaults.rootFolderPath,
          monitored: body.monitored ?? true,
          seasonFolder: body.seasonFolder ?? true,
          addOptions: body.addOptions || { searchForMissingEpisodes: true },
        };
        const data = await apiFetch(baseUrl, '/api/v3/series', SONARR_API_KEY, { method: 'POST', body: JSON.stringify(payload) });
        return json(data, 201);
      }
      case 'indexers': {
        const data = await apiFetch(baseUrl, '/api/v3/indexer', SONARR_API_KEY);
        return json({ indexers: data });
      }
      default:
        return json({ error: 'Unknown action' }, 400);
    }
  } catch (err) {
    console.error('Sonarr proxy error:', err);
    return offlineResponse(err, baseUrl, action);
  }
});
