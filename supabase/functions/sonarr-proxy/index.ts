import { corsHeaders } from '@supabase/supabase-js/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const SONARR_URL = Deno.env.get('SONARR_URL');
  const SONARR_API_KEY = Deno.env.get('SONARR_API_KEY');

  if (!SONARR_URL || !SONARR_API_KEY) {
    return new Response(JSON.stringify({ error: 'Sonarr not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const baseUrl = SONARR_URL.replace(/\/$/, '');
  const sonarrHeaders = { 'X-Api-Key': SONARR_API_KEY, 'Content-Type': 'application/json' };

  try {
    switch (action) {
      case 'status': {
        const res = await fetch(`${baseUrl}/api/v3/system/status`, { headers: sonarrHeaders });
        const data = await res.json();
        return new Response(JSON.stringify({ online: true, version: data.version }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      case 'series': {
        const res = await fetch(`${baseUrl}/api/v3/series`, { headers: sonarrHeaders });
        const data = await res.json();
        return new Response(JSON.stringify({ series: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      case 'search': {
        const term = url.searchParams.get('term');
        const res = await fetch(`${baseUrl}/api/v3/series/lookup?term=${encodeURIComponent(term || '')}`, { headers: sonarrHeaders });
        const data = await res.json();
        return new Response(JSON.stringify({ results: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      case 'add': {
        const body = await req.json();
        const res = await fetch(`${baseUrl}/api/v3/series`, {
          method: 'POST',
          headers: sonarrHeaders,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        return new Response(JSON.stringify(data), {
          status: res.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      case 'indexers': {
        const res = await fetch(`${baseUrl}/api/v3/indexer`, { headers: sonarrHeaders });
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
    console.error('Sonarr proxy error:', err);
    return new Response(JSON.stringify({ error: 'Failed to connect to Sonarr' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
