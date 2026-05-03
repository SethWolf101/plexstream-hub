const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function response(body: unknown, status = 200, contentType = 'application/json') {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': contentType },
  });
}

function sanitizePlexUrl(value: string) {
  let sanitized = value.replace(/\/web\/?$/, '').replace(/\/$/, '');
  if (/^https:\/\/\d+\.\d+\.\d+\.\d+/.test(sanitized)) sanitized = sanitized.replace(/^https:/, 'http:');
  return sanitized;
}

function tokenParam(token: string) {
  return `X-Plex-Token=${encodeURIComponent(token)}`;
}

function appendToken(url: string, token: string) {
  return `${url}${url.includes('?') ? '&' : '?'}${tokenParam(token)}`;
}

async function fetchPlex(baseUrl: string, pathOrUrl: string, token: string, init: RequestInit = {}) {
  const plexUrl = appendToken(pathOrUrl.startsWith('http') ? pathOrUrl : `${baseUrl}${pathOrUrl}`, token);
  console.log(`Plex request: ${plexUrl.replace(token, '***')}`);
  const res = await fetch(plexUrl, {
    ...init,
    headers: {
      Accept: 'application/json',
      'X-Plex-Client-Identifier': 'seths-streams',
      'X-Plex-Product': 'Seths Streams',
      'X-Plex-Version': '1.0',
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(30000),
  });
  return res;
}

async function plexJson(baseUrl: string, path: string, token: string) {
  const res = await fetchPlex(baseUrl, path, token);
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();
  if (!res.ok) throw new Error(`Plex returned ${res.status}: ${text.substring(0, 300)}`);
  if (contentType.includes('xml') || text.trim().startsWith('<')) throw new Error('Plex returned XML instead of JSON');
  return JSON.parse(text);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const PLEX_URL = Deno.env.get('PLEX_URL');
  const PLEX_TOKEN = Deno.env.get('PLEX_TOKEN');
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';

  if (!PLEX_URL || !PLEX_TOKEN) {
    return response({ error: 'Plex not configured. Set PLEX_URL and PLEX_TOKEN.' }, 500);
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const baseUrl = sanitizePlexUrl(PLEX_URL);

  try {
    switch (action) {
      case 'status': {
        const data = await plexJson(baseUrl, '/identity', PLEX_TOKEN);
        return response({ online: true, name: data?.MediaContainer?.friendlyName || data?.MediaContainer?.machineIdentifier || 'Plex Server' });
      }
      case 'libraries': {
        const data = await plexJson(baseUrl, '/library/sections', PLEX_TOKEN);
        return response({
          libraries: (data?.MediaContainer?.Directory || []).map((d: any) => ({ key: d.key, title: d.title, type: d.type })),
        });
      }
      case 'library': {
        const sectionId = url.searchParams.get('sectionId');
        if (!sectionId) return response({ error: 'sectionId required' }, 400);
        const size = url.searchParams.get('size') || '250';
        const data = await plexJson(baseUrl, `/library/sections/${sectionId}/all?X-Plex-Container-Start=0&X-Plex-Container-Size=${encodeURIComponent(size)}`, PLEX_TOKEN);
        return response({ items: (data?.MediaContainer?.Metadata || []).map((m: any) => transformMedia(m, baseUrl, PLEX_TOKEN)) });
      }
      case 'recently-added': {
        const data = await plexJson(baseUrl, '/library/recentlyAdded?X-Plex-Container-Start=0&X-Plex-Container-Size=50', PLEX_TOKEN);
        return response({ items: (data?.MediaContainer?.Metadata || []).map((m: any) => transformMedia(m, baseUrl, PLEX_TOKEN)) });
      }
      case 'search': {
        const query = url.searchParams.get('query');
        if (!query) return response({ error: 'query required' }, 400);
        const data = await plexJson(baseUrl, `/hubs/search?query=${encodeURIComponent(query)}&limit=40`, PLEX_TOKEN);
        const hubs = data?.MediaContainer?.Hub || [];
        const items: any[] = [];
        for (const hub of hubs) for (const m of hub.Metadata || []) items.push(transformMedia(m, baseUrl, PLEX_TOKEN));
        return response({ items });
      }
      case 'metadata': {
        const ratingKey = url.searchParams.get('ratingKey');
        if (!ratingKey) return response({ error: 'ratingKey required' }, 400);
        const data = await plexJson(baseUrl, `/library/metadata/${ratingKey}`, PLEX_TOKEN);
        return response({ items: (data?.MediaContainer?.Metadata || []).map((m: any) => transformMedia(m, baseUrl, PLEX_TOKEN)) });
      }
      case 'children': {
        const ratingKey = url.searchParams.get('ratingKey');
        if (!ratingKey) return response({ error: 'ratingKey required' }, 400);
        const data = await plexJson(baseUrl, `/library/metadata/${ratingKey}/children`, PLEX_TOKEN);
        return response({ items: (data?.MediaContainer?.Metadata || []).map((m: any) => transformMedia(m, baseUrl, PLEX_TOKEN)) });
      }
      case 'all-leaves': {
        const ratingKey = url.searchParams.get('ratingKey');
        if (!ratingKey) return response({ error: 'ratingKey required' }, 400);
        const data = await plexJson(baseUrl, `/library/metadata/${ratingKey}/allLeaves`, PLEX_TOKEN);
        return response({ items: (data?.MediaContainer?.Metadata || []).map((m: any) => transformMedia(m, baseUrl, PLEX_TOKEN)) });
      }
      case 'image': {
        const path = url.searchParams.get('path');
        if (!path || !path.startsWith('/')) return response({ error: 'valid image path required' }, 400);
        const res = await fetchPlex(baseUrl, path, PLEX_TOKEN, { headers: { Accept: 'image/*,*/*' } });
        if (!res.ok) return response({ error: 'Plex image failed', status: res.status }, 502);
        return new Response(res.body, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': res.headers.get('content-type') || 'image/jpeg',
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }
      case 'hls': {
        const ratingKey = url.searchParams.get('ratingKey');
        if (!ratingKey) return response({ error: 'ratingKey required' }, 400);
        const playableRatingKey = await resolvePlayableRatingKey(baseUrl, ratingKey, PLEX_TOKEN);
        const path = encodeURIComponent(`/library/metadata/${playableRatingKey}`);
        const session = crypto.randomUUID().replaceAll('-', '');
        const hlsPath = `/video/:/transcode/universal/start.m3u8?path=${path}&mediaIndex=0&partIndex=0&protocol=hls&offset=0&fastSeek=1&directPlay=0&directStream=1&copyts=1&subtitleSize=100&audioBoost=100&maxVideoBitrate=40000&videoQuality=100&session=${session}`;
        const res = await fetchPlex(baseUrl, hlsPath, PLEX_TOKEN, { headers: { Accept: 'application/vnd.apple.mpegurl,*/*' } });
        const playlist = await res.text();
        if (!res.ok) return response({ error: 'Plex could not start the stream', details: playlist.substring(0, 500) }, 502);
        return response(rewritePlaylist(playlist, req.url, baseUrl, SUPABASE_ANON_KEY), 200, 'application/vnd.apple.mpegurl');
      }
      case 'segment': {
        const path = url.searchParams.get('path');
        if (!path) return response({ error: 'path required' }, 400);
        const upstream = path.startsWith('http') ? path : `${baseUrl}${path}`;
        const res = await fetchPlex(baseUrl, upstream, PLEX_TOKEN, { headers: { Accept: '*/*' } });
        if (!res.ok) return response({ error: 'Plex stream segment failed', status: res.status }, 502);
        return new Response(res.body, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': res.headers.get('content-type') || 'application/octet-stream',
            'Cache-Control': 'no-store',
          },
        });
      }
      default:
        return response({ error: 'Unknown action. Use: status, libraries, library, recently-added, search, metadata, children, all-leaves, image, hls, segment' }, 400);
    }
  } catch (err) {
    console.error('Plex proxy error:', err);
    return response({
      error: 'Failed to connect to Plex',
      details: err instanceof Error ? err.message : 'Unknown error',
      hint: 'Check that PLEX_URL is correct and accessible from the internet.',
    }, 502);
  }
});

function rewritePlaylist(playlist: string, requestUrl: string, baseUrl: string, anonKey: string) {
  const origin = new URL(requestUrl).origin;
  const pathname = new URL(requestUrl).pathname;
  return playlist.split('\n').map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const absolute = trimmed.startsWith('http') ? trimmed : `${baseUrl}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
    const qs = new URLSearchParams({ action: 'segment', path: absolute });
    if (anonKey) qs.set('apikey', anonKey);
    return `${origin}${pathname}?${qs.toString()}`;
  }).join('\n');
}

async function resolvePlayableRatingKey(baseUrl: string, ratingKey: string, token: string) {
  const metadata = await plexJson(baseUrl, `/library/metadata/${ratingKey}`, token);
  const item = metadata?.MediaContainer?.Metadata?.[0];
  if (!item || item.type === 'movie' || item.type === 'episode') return ratingKey;

  const leavesPath = item.type === 'season'
    ? `/library/metadata/${ratingKey}/children`
    : `/library/metadata/${ratingKey}/allLeaves`;
  const leaves = await plexJson(baseUrl, leavesPath, token);
  const episode = (leaves?.MediaContainer?.Metadata || []).find((entry: any) => entry.type === 'episode' && entry.Media?.[0]?.Part?.[0]?.key);
  if (!episode?.ratingKey) throw new Error('No playable episode found for this show.');
  return episode.ratingKey;
}

function proxiedImageUrl(path: string | undefined, anonKey: string) {
  if (!path) return '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) return '';
  const qs = new URLSearchParams({ action: 'image', path });
  if (anonKey) qs.set('apikey', anonKey);
  return `${supabaseUrl}/functions/v1/plex-proxy?${qs.toString()}`;
}

function transformMedia(m: any, baseUrl: string, token: string) {
  const media = m.Media?.[0];
  const part = media?.Part?.[0];
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
  return {
    ratingKey: m.ratingKey,
    title: m.title,
    summary: m.summary || '',
    thumb: proxiedImageUrl(m.thumb, anonKey),
    art: proxiedImageUrl(m.art || m.parentThumb || m.grandparentArt || m.grandparentThumb, anonKey),
    year: m.year,
    type: m.type,
    rating: m.rating,
    contentRating: m.contentRating,
    duration: m.duration,
    genre: (m.Genre || []).map((g: any) => g.tag).join(', '),
    parentRatingKey: m.parentRatingKey,
    parentTitle: m.parentTitle,
    grandparentRatingKey: m.grandparentRatingKey,
    grandparentTitle: m.grandparentTitle,
    parentIndex: m.parentIndex,
    index: m.index,
    leafCount: m.leafCount,
    viewedLeafCount: m.viewedLeafCount,
    mediaKey: media?.key,
    partKey: part?.key,
  };
}
