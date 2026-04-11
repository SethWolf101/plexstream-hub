const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const PLEX_URL = Deno.env.get('PLEX_URL');
  const PLEX_TOKEN = Deno.env.get('PLEX_TOKEN');

  if (!PLEX_URL || !PLEX_TOKEN) {
    return new Response(JSON.stringify({ error: 'Plex not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const baseUrl = PLEX_URL.replace(/\/$/, '');
  const plexHeaders = { 'X-Plex-Token': PLEX_TOKEN, 'Accept': 'application/json' };

  try {
    let plexUrl = '';

    switch (action) {
      case 'status':
        plexUrl = `${baseUrl}/`;
        break;
      case 'libraries':
        plexUrl = `${baseUrl}/library/sections`;
        break;
      case 'library': {
        const sectionId = url.searchParams.get('sectionId');
        plexUrl = `${baseUrl}/library/sections/${sectionId}/all?X-Plex-Container-Start=0&X-Plex-Container-Size=50`;
        break;
      }
      case 'recently-added':
        plexUrl = `${baseUrl}/library/recentlyAdded?X-Plex-Container-Start=0&X-Plex-Container-Size=20`;
        break;
      case 'search': {
        const query = url.searchParams.get('query');
        plexUrl = `${baseUrl}/hubs/search?query=${encodeURIComponent(query || '')}&limit=20`;
        break;
      }
      case 'metadata': {
        const ratingKey = url.searchParams.get('ratingKey');
        plexUrl = `${baseUrl}/library/metadata/${ratingKey}`;
        break;
      }
      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const res = await fetch(plexUrl, { headers: plexHeaders });
    const data = await res.json();

    // Transform Plex response
    let result: any = {};

    if (action === 'status') {
      result = { online: true, name: data?.MediaContainer?.friendlyName };
    } else if (action === 'libraries') {
      result = {
        libraries: (data?.MediaContainer?.Directory || []).map((d: any) => ({
          key: d.key,
          title: d.title,
          type: d.type,
        })),
      };
    } else if (action === 'search') {
      const hubs = data?.MediaContainer?.Hub || [];
      const items: any[] = [];
      for (const hub of hubs) {
        for (const m of hub.Metadata || []) {
          items.push(transformMedia(m, baseUrl, PLEX_TOKEN));
        }
      }
      result = { items };
    } else {
      const metadata = data?.MediaContainer?.Metadata || [];
      result = {
        items: metadata.map((m: any) => transformMedia(m, baseUrl, PLEX_TOKEN)),
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Plex proxy error:', err);
    return new Response(JSON.stringify({ error: 'Failed to connect to Plex' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function transformMedia(m: any, baseUrl: string, token: string) {
  return {
    ratingKey: m.ratingKey,
    title: m.title,
    summary: m.summary || '',
    thumb: m.thumb ? `${baseUrl}${m.thumb}?X-Plex-Token=${token}` : '',
    art: m.art ? `${baseUrl}${m.art}?X-Plex-Token=${token}` : '',
    year: m.year,
    type: m.type,
    rating: m.rating,
    contentRating: m.contentRating,
    duration: m.duration,
    genre: (m.Genre || []).map((g: any) => g.tag).join(', '),
  };
}
