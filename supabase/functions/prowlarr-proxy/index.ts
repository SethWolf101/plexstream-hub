import { corsHeaders } from '@supabase/supabase-js/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const PROWLARR_URL = Deno.env.get('PROWLARR_URL');
  const PROWLARR_API_KEY = Deno.env.get('PROWLARR_API_KEY');
  const SONARR_URL = Deno.env.get('SONARR_URL');
  const SONARR_API_KEY = Deno.env.get('SONARR_API_KEY');

  if (!PROWLARR_URL || !PROWLARR_API_KEY) {
    return new Response(JSON.stringify({ error: 'Prowlarr not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const baseUrl = PROWLARR_URL.replace(/\/$/, '');
  const prowlarrHeaders = { 'X-Api-Key': PROWLARR_API_KEY, 'Content-Type': 'application/json' };

  try {
    switch (action) {
      case 'status': {
        const res = await fetch(`${baseUrl}/api/v1/system/status`, { headers: prowlarrHeaders });
        const data = await res.json();
        return new Response(JSON.stringify({ online: true, version: data.version }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      case 'indexers': {
        const res = await fetch(`${baseUrl}/api/v1/indexer`, { headers: prowlarrHeaders });
        const data = await res.json();
        return new Response(JSON.stringify({ indexers: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      case 'sync-indexers': {
        // Get Prowlarr indexers
        const prowRes = await fetch(`${baseUrl}/api/v1/indexer`, { headers: prowlarrHeaders });
        const prowlarrIndexers = await prowRes.json();

        if (!SONARR_URL || !SONARR_API_KEY) {
          return new Response(JSON.stringify({ error: 'Sonarr not configured for sync' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Get existing Sonarr indexers
        const sonarrBase = SONARR_URL.replace(/\/$/, '');
        const sonarrHeaders = { 'X-Api-Key': SONARR_API_KEY, 'Content-Type': 'application/json' };
        const sonarrRes = await fetch(`${sonarrBase}/api/v3/indexer`, { headers: sonarrHeaders });
        const sonarrIndexers = await sonarrRes.json();
        const existingNames = new Set(sonarrIndexers.map((i: any) => i.name));

        let added = 0;
        for (const indexer of prowlarrIndexers) {
          if (existingNames.has(indexer.name)) continue;

          // Add indexer to Sonarr via Prowlarr's app sync
          // This triggers Prowlarr's built-in sync
          added++;
        }

        // Trigger Prowlarr app sync
        await fetch(`${baseUrl}/api/v1/command`, {
          method: 'POST',
          headers: prowlarrHeaders,
          body: JSON.stringify({ name: 'AppIndexerSync' }),
        });

        return new Response(JSON.stringify({ count: prowlarrIndexers.length, synced: true }), {
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
    console.error('Prowlarr proxy error:', err);
    return new Response(JSON.stringify({ error: 'Failed to connect to Prowlarr' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
