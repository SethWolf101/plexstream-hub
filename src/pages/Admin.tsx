import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Users, FileText, Server, CheckCircle, XCircle, RefreshCw, Plus, Search, Download, Tv, Film, Save } from 'lucide-react';

type ServiceName = 'sonarr' | 'radarr' | 'prowlarr';

const configurableServices: { name: ServiceName; label: string; urlPlaceholder: string }[] = [
  { name: 'sonarr', label: 'Sonarr', urlPlaceholder: 'http://your-ip:8989 or https://your-tunnel/sonarr' },
  { name: 'radarr', label: 'Radarr', urlPlaceholder: 'http://your-ip:7878 or https://your-tunnel/radarr' },
  { name: 'prowlarr', label: 'Prowlarr', urlPlaceholder: 'http://your-ip:9696 or https://your-tunnel/prowlarr' },
];

export default function Admin() {
  const { isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [serviceStatus, setServiceStatus] = useState<Record<string, { online: boolean; version?: string; name?: string; error?: string; details?: string }>>({});
  const [checkingServices, setCheckingServices] = useState(false);
  const [serviceConfigs, setServiceConfigs] = useState<Record<ServiceName, { base_url: string; api_key: string }>>({
    sonarr: { base_url: '', api_key: '' },
    radarr: { base_url: '', api_key: '' },
    prowlarr: { base_url: '', api_key: '' },
  });
  const [savingService, setSavingService] = useState<ServiceName | null>(null);

  // Sonarr state
  const [sonarrSeries, setSonarrSeries] = useState<any[]>([]);
  const [sonarrSearch, setSonarrSearch] = useState('');
  const [sonarrResults, setSonarrResults] = useState<any[]>([]);
  const [searchingSonarr, setSearchingSonarr] = useState(false);

  // Radarr state
  const [radarrMovies, setRadarrMovies] = useState<any[]>([]);
  const [radarrSearch, setRadarrSearch] = useState('');
  const [radarrResults, setRadarrResults] = useState<any[]>([]);
  const [searchingRadarr, setSearchingRadarr] = useState(false);

  // Prowlarr state
  const [indexers, setIndexers] = useState<any[]>([]);
  const [sonarrIndexers, setSonarrIndexers] = useState<any[]>([]);
  const [radarrIndexers, setRadarrIndexers] = useState<any[]>([]);

  useEffect(() => {
    if (!isLoading && !isAdmin) navigate('/');
  }, [isAdmin, isLoading]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchRequests();
      fetchServiceConfigs();
      checkServices();
      fetchSonarrSeries();
      fetchRadarrMovies();
      fetchIndexers();
    }
  }, [isAdmin]);

  const apiCall = async (fn: string, params: Record<string, string> = {}) => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`https://${projectId}.supabase.co/functions/v1/${fn}?${qs}`, {
      headers: { 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
    });
    return res;
  };

  const apiPost = async (fn: string, params: Record<string, string>, body: any) => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`https://${projectId}.supabase.co/functions/v1/${fn}?${qs}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res;
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*');
    setUsers(data || []);
  };

  const fetchRequests = async () => {
    const { data } = await supabase
      .from('content_requests')
      .select('*')
      .order('created_at', { ascending: false });
    setRequests(data || []);
  };

  const fetchServiceConfigs = async () => {
    const { data } = await supabase.from('service_configs').select('service_name,base_url,api_key');
    if (!data) return;
    setServiceConfigs(prev => {
      const next = { ...prev };
      data.forEach((cfg: any) => {
        if (cfg.service_name in next) next[cfg.service_name as ServiceName] = { base_url: cfg.base_url || '', api_key: cfg.api_key || '' };
      });
      return next;
    });
  };

  const saveServiceConfig = async (serviceName: ServiceName) => {
    const cfg = serviceConfigs[serviceName];
    if (!cfg.base_url.trim() || !cfg.api_key.trim()) {
      toast({ title: 'Missing details', description: 'Add both the URL and API key.', variant: 'destructive' });
      return;
    }

    setSavingService(serviceName);
    const { error } = await supabase.from('service_configs').upsert({
      service_name: serviceName,
      base_url: cfg.base_url.trim(),
      api_key: cfg.api_key.trim(),
    }, { onConflict: 'service_name' });
    setSavingService(null);

    if (error) {
      toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Saved', description: `${serviceName} settings saved.` });
    checkServices();
  };

  const serviceErrorMessage = async (res: Response, fallback: string) => {
    const data = await res.json().catch(() => ({}));
    return data?.details || data?.error || fallback;
  };

  const checkServices = async () => {
    setCheckingServices(true);
    const results: Record<string, any> = {};

    for (const [name, fn] of [['plex', 'plex-proxy'], ['sonarr', 'sonarr-proxy'], ['radarr', 'radarr-proxy'], ['prowlarr', 'prowlarr-proxy']]) {
      try {
        const res = await apiCall(fn, { action: 'status' });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          results[name] = { ...data, online: data.online !== false };
        } else {
          results[name] = { online: false, error: data.error || 'Disconnected', details: data.details };
        }
      } catch (err) {
        results[name] = { online: false, error: err instanceof Error ? err.message : 'Disconnected' };
      }
    }
    setServiceStatus(results);
    setCheckingServices(false);
  };

  const updateRequestStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('content_requests').update({ status }).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Updated', description: `Request ${status}.` });
      fetchRequests();
    }
  };

  // Sonarr functions
  const fetchSonarrSeries = async () => {
    try {
      const res = await apiCall('sonarr-proxy', { action: 'series' });
      if (res.ok) {
        const data = await res.json();
        setSonarrSeries(data.series || []);
      }
    } catch { /* */ }
  };

  const searchSonarr = async () => {
    if (!sonarrSearch.trim()) return;
    setSearchingSonarr(true);
    try {
      const res = await apiCall('sonarr-proxy', { action: 'search', term: sonarrSearch });
      if (res.ok) {
        const data = await res.json();
        if (data.online === false) throw new Error(data.details || data.error || 'Sonarr is offline.');
        setSonarrResults(data.results || []);
      } else {
        throw new Error(await serviceErrorMessage(res, 'Show search failed.'));
      }
    } catch (err) {
      toast({ title: 'Show search failed', description: err instanceof Error ? err.message : 'Check Sonarr settings.', variant: 'destructive' });
    }
    setSearchingSonarr(false);
  };

  const addToSonarr = async (show: any) => {
    try {
      const res = await apiPost('sonarr-proxy', { action: 'add' }, {
        title: show.title,
        tvdbId: show.tvdbId,
        titleSlug: show.titleSlug,
        images: show.images,
        seasons: show.seasons,
        monitored: true,
        seasonFolder: true,
        addOptions: { searchForMissingEpisodes: true },
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.online === false) throw new Error(data.details || data.error || 'Sonarr is offline.');
        toast({ title: 'Added!', description: `"${show.title}" added to Sonarr.` });
        fetchSonarrSeries();
      } else {
        throw new Error(await serviceErrorMessage(res, 'Failed to add show.'));
      }
    } catch (err) {
      toast({ title: 'Could not add show', description: err instanceof Error ? err.message : 'Check Sonarr settings.', variant: 'destructive' });
    }
  };

  // Radarr functions
  const fetchRadarrMovies = async () => {
    try {
      const res = await apiCall('radarr-proxy', { action: 'movies' });
      if (res.ok) {
        const data = await res.json();
        setRadarrMovies(data.movies || []);
      }
    } catch { /* */ }
  };

  const searchRadarr = async () => {
    if (!radarrSearch.trim()) return;
    setSearchingRadarr(true);
    try {
      const res = await apiCall('radarr-proxy', { action: 'search', term: radarrSearch });
      if (res.ok) {
        const data = await res.json();
        if (data.online === false) throw new Error(data.details || data.error || 'Radarr is offline.');
        setRadarrResults(data.results || []);
      } else {
        throw new Error(await serviceErrorMessage(res, 'Movie search failed.'));
      }
    } catch (err) {
      toast({ title: 'Movie search failed', description: err instanceof Error ? err.message : 'Check Radarr settings.', variant: 'destructive' });
    }
    setSearchingRadarr(false);
  };

  const addToRadarr = async (movie: any) => {
    try {
      const res = await apiPost('radarr-proxy', { action: 'add' }, {
        title: movie.title,
        tmdbId: movie.tmdbId,
        titleSlug: movie.titleSlug,
        images: movie.images,
        year: movie.year,
        monitored: true,
        addOptions: { searchForMovie: true },
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.online === false) throw new Error(data.details || data.error || 'Radarr is offline.');
        toast({ title: 'Added!', description: `"${movie.title}" added to Radarr.` });
        fetchRadarrMovies();
      } else {
        throw new Error(await serviceErrorMessage(res, 'Failed to add movie.'));
      }
    } catch (err) {
      toast({ title: 'Could not add movie', description: err instanceof Error ? err.message : 'Check Radarr settings.', variant: 'destructive' });
    }
  };
  const fetchIndexers = async () => {
    try {
      const [prowRes, sonRes, radRes] = await Promise.all([
        apiCall('prowlarr-proxy', { action: 'indexers' }),
        apiCall('sonarr-proxy', { action: 'indexers' }),
        apiCall('radarr-proxy', { action: 'indexers' }),
      ]);
      if (prowRes.ok) {
        const data = await prowRes.json();
        setIndexers(data.indexers || []);
      }
      if (sonRes.ok) {
        const data = await sonRes.json();
        setSonarrIndexers(data.indexers || []);
      }
      if (radRes.ok) {
        const data = await radRes.json();
        setRadarrIndexers(data.indexers || []);
      }
    } catch { /* */ }
  };

  const syncIndexers = async () => {
    try {
      const res = await apiCall('prowlarr-proxy', { action: 'sync-indexers' });
      if (res.ok) {
        const data = await res.json();
        toast({ title: 'Indexers Synced!', description: `${data.count || 0} indexers synced from Prowlarr to Sonarr & Radarr.` });
        fetchIndexers();
      } else {
        toast({ title: 'Error', description: 'Failed to sync indexers.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Sync failed.', variant: 'destructive' });
    }
  };

  if (isLoading) return <div className="min-h-screen bg-background pt-24 flex items-center justify-center"><p>Loading...</p></div>;
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background pt-24 px-4 sm:px-8 lg:px-16 max-w-7xl mx-auto pb-12">
      <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>

      <Tabs defaultValue="services" className="space-y-6">
        <TabsList className="bg-secondary flex-wrap h-auto gap-1">
          <TabsTrigger value="services"><Server className="w-4 h-4 mr-1" />Services</TabsTrigger>
          <TabsTrigger value="sonarr"><Tv className="w-4 h-4 mr-1" />TV (Sonarr)</TabsTrigger>
          <TabsTrigger value="radarr"><Film className="w-4 h-4 mr-1" />Movies (Radarr)</TabsTrigger>
          <TabsTrigger value="indexers"><Download className="w-4 h-4 mr-1" />Indexers</TabsTrigger>
          <TabsTrigger value="requests"><FileText className="w-4 h-4 mr-1" />Requests</TabsTrigger>
          <TabsTrigger value="users"><Users className="w-4 h-4 mr-1" />Users</TabsTrigger>
        </TabsList>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {['plex', 'sonarr', 'radarr', 'prowlarr'].map(name => {
              const s = serviceStatus[name];
              return (
                <Card key={name} className="bg-card border-border">
                  <CardContent className="py-6">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-semibold capitalize text-lg">{name}</p>
                      <div className={`w-3 h-3 rounded-full ${s?.online ? 'bg-primary' : checkingServices ? 'bg-muted-foreground animate-pulse' : 'bg-destructive'}`} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {checkingServices ? 'Checking...' : s?.online ? `Connected${s.version ? ` (v${s.version})` : ''}${s.name ? ` - ${s.name}` : ''}` : (s?.details || s?.error || 'Disconnected')}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Button onClick={checkServices} disabled={checkingServices}>
            <RefreshCw className={`w-4 h-4 mr-2 ${checkingServices ? 'animate-spin' : ''}`} />
            Refresh Status
          </Button>
        </TabsContent>

        {/* Sonarr Tab - Add/Manage Shows */}
        <TabsContent value="sonarr" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Plus className="w-5 h-5" /> Add New Show</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 mb-4">
                <Input
                  value={sonarrSearch}
                  onChange={e => setSonarrSearch(e.target.value)}
                  placeholder="Search for a show to add..."
                  className="bg-secondary border-border"
                  onKeyDown={e => e.key === 'Enter' && searchSonarr()}
                />
                <Button onClick={searchSonarr} disabled={searchingSonarr}>
                  <Search className="w-4 h-4 mr-2" />
                  {searchingSonarr ? 'Searching...' : 'Search'}
                </Button>
              </div>
              {sonarrResults.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                  {sonarrResults.map((show: any) => (
                    <div key={show.tvdbId} className="flex gap-3 p-3 bg-secondary rounded-lg">
                      {show.remotePoster && (
                        <img src={show.remotePoster} alt={show.title} className="w-16 h-24 object-cover rounded" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{show.title}</p>
                        <p className="text-xs text-muted-foreground">{show.year} • {show.network}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{show.overview}</p>
                        <Button size="sm" className="mt-2" onClick={() => addToSonarr(show)}>
                          <Plus className="w-3 h-3 mr-1" /> Add
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Current Library ({sonarrSeries.length} shows)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {sonarrSeries.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{s.title}</p>
                      <p className="text-xs text-muted-foreground">{s.year} • {s.seasonCount} seasons • {s.episodeFileCount}/{s.episodeCount} episodes</p>
                    </div>
                    <Badge variant={s.status === 'continuing' ? 'default' : 'secondary'}>{s.status}</Badge>
                  </div>
                ))}
                {sonarrSeries.length === 0 && <p className="text-muted-foreground text-center py-4">No series in Sonarr yet. Search and add above.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Radarr Tab - Add/Manage Movies */}
        <TabsContent value="radarr" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Plus className="w-5 h-5" /> Add New Movie</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 mb-4">
                <Input
                  value={radarrSearch}
                  onChange={e => setRadarrSearch(e.target.value)}
                  placeholder="Search for a movie to add..."
                  className="bg-secondary border-border"
                  onKeyDown={e => e.key === 'Enter' && searchRadarr()}
                />
                <Button onClick={searchRadarr} disabled={searchingRadarr}>
                  <Search className="w-4 h-4 mr-2" />
                  {searchingRadarr ? 'Searching...' : 'Search'}
                </Button>
              </div>
              {radarrResults.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                  {radarrResults.map((movie: any) => (
                    <div key={movie.tmdbId} className="flex gap-3 p-3 bg-secondary rounded-lg">
                      {movie.remotePoster && (
                        <img src={movie.remotePoster} alt={movie.title} className="w-16 h-24 object-cover rounded" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{movie.title}</p>
                        <p className="text-xs text-muted-foreground">{movie.year} • {movie.studio}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{movie.overview}</p>
                        <Button size="sm" className="mt-2" onClick={() => addToRadarr(movie)}>
                          <Plus className="w-3 h-3 mr-1" /> Add
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Current Library ({radarrMovies.length} movies)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {radarrMovies.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{m.title}</p>
                      <p className="text-xs text-muted-foreground">{m.year} • {m.hasFile ? 'Downloaded' : 'Missing'}</p>
                    </div>
                    <Badge variant={m.monitored ? 'default' : 'secondary'}>{m.monitored ? 'Monitored' : 'Unmonitored'}</Badge>
                  </div>
                ))}
                {radarrMovies.length === 0 && <p className="text-muted-foreground text-center py-4">No movies in Radarr yet. Search and add above.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Indexers Tab */}
        <TabsContent value="indexers" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Indexer Management</h2>
            <div className="flex gap-3">
              <Button onClick={fetchIndexers}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
              <Button onClick={syncIndexers} variant="default">
                <Download className="w-4 h-4 mr-2" />Sync to Sonarr & Radarr
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg">Prowlarr Indexers ({indexers.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {indexers.map((idx: any) => (
                    <div key={idx.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{idx.name}</p>
                        <p className="text-xs text-muted-foreground">{idx.protocol} • {idx.privacy}</p>
                      </div>
                      <Badge variant={idx.enable ? 'default' : 'secondary'}>
                        {idx.enable ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                  ))}
                  {indexers.length === 0 && <p className="text-muted-foreground text-center py-4">No indexers found in Prowlarr.</p>}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg">Sonarr Indexers ({sonarrIndexers.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {sonarrIndexers.map((idx: any) => (
                    <div key={idx.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{idx.name}</p>
                        <p className="text-xs text-muted-foreground">{idx.protocol}</p>
                      </div>
                      <Badge variant={idx.enableRss ? 'default' : 'secondary'}>
                        {idx.enableRss ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  ))}
                  {sonarrIndexers.length === 0 && <p className="text-muted-foreground text-center py-4">No indexers in Sonarr. Click "Sync All" to add from Prowlarr.</p>}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg">Radarr Indexers ({radarrIndexers.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {radarrIndexers.map((idx: any) => (
                    <div key={idx.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{idx.name}</p>
                        <p className="text-xs text-muted-foreground">{idx.protocol}</p>
                      </div>
                      <Badge variant={idx.enableRss ? 'default' : 'secondary'}>
                        {idx.enableRss ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  ))}
                  {radarrIndexers.length === 0 && <p className="text-muted-foreground text-center py-4">No indexers in Radarr. Click "Sync" to add from Prowlarr.</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Requests Tab */}
        <TabsContent value="requests" className="space-y-3">
          {requests.map(req => (
            <Card key={req.id} className="bg-card border-border">
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{req.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(req.created_at).toLocaleDateString()} • {req.media_type}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={req.status === 'approved' ? 'default' : req.status === 'rejected' ? 'destructive' : 'secondary'}>
                    {req.status}
                  </Badge>
                  {req.status === 'pending' && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => updateRequestStatus(req.id, 'approved')}>
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => updateRequestStatus(req.id, 'rejected')}>
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {requests.length === 0 && <p className="text-center text-muted-foreground py-8">No requests yet.</p>}
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-3">
          {users.map(u => (
            <Card key={u.id} className="bg-card border-border">
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{u.display_name || 'No name'}</p>
                  <p className="text-sm text-muted-foreground">{u.email}</p>
                </div>
                <p className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</p>
              </CardContent>
            </Card>
          ))}
          {users.length === 0 && <p className="text-center text-muted-foreground py-8">No users yet.</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
