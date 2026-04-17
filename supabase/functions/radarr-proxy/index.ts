const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const RADARR_URL = Deno.env.get('RADARR_URL');
  const RADARR_API_KEY = Deno.env.get('RADARR_API_KEY');

  if (!RADARR_URL || !RADARR_API_KEY) {
    return new Response(JSON.stringify({ error: 'Radarr not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const baseUrl = RADARR_URL.replace(/\/$/, '');
  const radarrHeaders = { 'X-Api-Key': RADARR_API_KEY, 'Content-Type': 'application/json' };

  try {
    switch (action) {
      case 'status': {
        const res = await fetch(`${baseUrl}/api/v3/system/status`, { headers: radarrHeaders });
        const data = await res.json();
        return new Response(JSON.stringify({ online: true, version: data.version }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      case 'movies': {
        const res = await fetch(`${baseUrl}/api/v3/movie`, { headers: radarrHeaders });
        const data = await res.json();
        return new Response(JSON.stringify({ movies: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      case 'search': {
        const term = url.searchParams.get('term');
        const res = await fetch(`${baseUrl}/api/v3/movie/lookup?term=${encodeURIComponent(term || '')}`, { headers: radarrHeaders });
        const data = await res.json();
        return new Response(JSON.stringify({ results: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      case 'add': {
        const body = await req.json();
        const res = await fetch(`${baseUrl}/api/v3/movie`, {
          method: 'POST',
          headers: radarrHeaders,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        return new Response(JSON.stringify(data), {
          status: res.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      case 'indexers': {
        const res = await fetch(`${baseUrl}/api/v3/indexer`, { headers: radarrHeaders });
        const data = await res.json();
        return new Response(JSON.stringify({ indexers: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (err) {
    console.error('Radarr proxy error:', err);
    return new Response(JSON.stringify({ error: 'Failed to connect to Radarr' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
