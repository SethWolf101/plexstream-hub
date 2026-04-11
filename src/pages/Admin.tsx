import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Users, FileText, Server, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

export default function Admin() {
  const { isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [serviceStatus, setServiceStatus] = useState<Record<string, 'online' | 'offline' | 'checking'>>({
    plex: 'checking',
    sonarr: 'checking',
    prowlarr: 'checking',
  });

  useEffect(() => {
    if (!isLoading && !isAdmin) navigate('/');
  }, [isAdmin, isLoading]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchRequests();
      checkServices();
    }
  }, [isAdmin]);

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

  const checkServices = async () => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const headers = { 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey };

    for (const service of ['plex', 'sonarr', 'prowlarr']) {
      try {
        const fn = service === 'plex' ? 'plex-proxy' : `${service}-proxy`;
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/${fn}?action=status`,
          { headers }
        );
        setServiceStatus(prev => ({ ...prev, [service]: res.ok ? 'online' : 'offline' }));
      } catch {
        setServiceStatus(prev => ({ ...prev, [service]: 'offline' }));
      }
    }
  };

  const updateRequestStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from('content_requests')
      .update({ status })
      .eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Updated', description: `Request ${status}.` });
      fetchRequests();
    }
  };

  const syncIndexers = async () => {
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/prowlarr-proxy?action=sync-indexers`,
        { headers: { 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey } }
      );
      if (res.ok) {
        const data = await res.json();
        toast({ title: 'Indexers Synced', description: `${data.count || 0} indexers synced to Sonarr.` });
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
    <div className="min-h-screen bg-background pt-24 px-4 sm:px-8 lg:px-16 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>

      <Tabs defaultValue="services" className="space-y-6">
        <TabsList className="bg-secondary">
          <TabsTrigger value="services"><Server className="w-4 h-4 mr-2" />Services</TabsTrigger>
          <TabsTrigger value="requests"><FileText className="w-4 h-4 mr-2" />Requests</TabsTrigger>
          <TabsTrigger value="users"><Users className="w-4 h-4 mr-2" />Users</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(serviceStatus).map(([name, status]) => (
              <Card key={name} className="bg-card border-border">
                <CardContent className="py-6 flex items-center justify-between">
                  <div>
                    <p className="font-semibold capitalize text-lg">{name}</p>
                    <p className="text-sm text-muted-foreground">
                      {status === 'checking' ? 'Checking...' : status === 'online' ? 'Connected' : 'Disconnected'}
                    </p>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${status === 'online' ? 'bg-green-500' : status === 'offline' ? 'bg-destructive' : 'bg-yellow-500 animate-pulse'}`} />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex gap-3">
            <Button onClick={checkServices}><RefreshCw className="w-4 h-4 mr-2" />Refresh Status</Button>
            <Button variant="outline" onClick={syncIndexers}>Sync Indexers (Prowlarr → Sonarr)</Button>
          </div>
        </TabsContent>

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
        </TabsContent>
      </Tabs>
    </div>
  );
}
