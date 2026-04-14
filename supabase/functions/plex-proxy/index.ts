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
    return new Response(JSON.stringify({ error: 'Plex not configured. Set PLEX_URL and PLEX_TOKEN.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const baseUrl = PLEX_URL.replace(/\/web\/?$/, '').replace(/\/$/, '');
  const plexHeaders = {
    'X-Plex-Token': PLEX_TOKEN,
    'Accept': 'application/json',
    'X-Plex-Client-Identifier': 'seths-streams',
    'X-Plex-Product': 'Seths Streams',
    'X-Plex-Version': '1.0',
  };

  try {
    let plexUrl = '';

    switch (action) {
      case 'status':
        plexUrl = `${baseUrl}/identity`;
        break;
      case 'libraries':
        plexUrl = `${baseUrl}/library/sections`;
        break;
      case 'library': {
        const sectionId = url.searchParams.get('sectionId');
        if (!sectionId) {
          return new Response(JSON.stringify({ error: 'sectionId required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        plexUrl = `${baseUrl}/library/sections/${sectionId}/all?X-Plex-Container-Start=0&X-Plex-Container-Size=50`;
        break;
      }
      case 'recently-added':
        plexUrl = `${baseUrl}/library/recentlyAdded?X-Plex-Container-Start=0&X-Plex-Container-Size=20`;
        break;
      case 'search': {
        const query = url.searchParams.get('query');
        if (!query) {
          return new Response(JSON.stringify({ error: 'query required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        plexUrl = `${baseUrl}/hubs/search?query=${encodeURIComponent(query)}&limit=20`;
        break;
      }
      case 'metadata': {
        const ratingKey = url.searchParams.get('ratingKey');
        if (!ratingKey) {
          return new Response(JSON.stringify({ error: 'ratingKey required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        plexUrl = `${baseUrl}/library/metadata/${ratingKey}`;
        break;
      }
      default:
        return new Response(JSON.stringify({ error: 'Unknown action. Use: status, libraries, library, recently-added, search, metadata' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    console.log(`Plex request: ${plexUrl}`);
    // @ts-ignore - Deno supports this option for self-signed certs
    const res = await fetch(plexUrl, { headers: plexHeaders, client: Deno.createHttpClient({ caCerts: [], proxy: undefined }) } as any);
    const contentType = res.headers.get('content-type') || '';
    const responseText = await res.text();

    if (!res.ok) {
      console.error(`Plex returned ${res.status}: ${responseText.substring(0, 500)}`);
      return new Response(JSON.stringify({ 
        error: `Plex returned status ${res.status}`,
        hint: 'Check your PLEX_URL and PLEX_TOKEN. PLEX_URL should be like https://your-plex-server:32400'
      }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let data: any;
    if (contentType.includes('json')) {
      data = JSON.parse(responseText);
    } else if (contentType.includes('xml') || responseText.trim().startsWith('<')) {
      // Plex returned XML — likely missing Accept header or old Plex version
      console.log('Plex returned non-JSON. Content-Type:', contentType);
      return new Response(JSON.stringify({
        error: 'Plex returned XML instead of JSON',
        hint: 'Your Plex server may need updating, or the URL format may be incorrect. Make sure PLEX_URL points directly to your Plex server (e.g., https://hostname:32400)',
        contentType,
      }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      data = JSON.parse(responseText);
    }

    // Transform response
    let result: any = {};

    if (action === 'status') {
      result = { online: true, name: data?.MediaContainer?.friendlyName || data?.MediaContainer?.machineIdentifier || 'Plex Server' };
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
    return new Response(JSON.stringify({ 
      error: 'Failed to connect to Plex',
      details: err instanceof Error ? err.message : 'Unknown error',
      hint: 'Check that PLEX_URL is correct and accessible from the internet (e.g., https://your-appbox-domain:32400)'
    }), {
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
