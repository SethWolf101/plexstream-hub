import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Clock, CheckCircle, XCircle } from 'lucide-react';

export default function Requests() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) fetchRequests();
  }, [user]);

  const fetchRequests = async () => {
    const { data } = await supabase
      .from('content_requests')
      .select('*')
      .order('created_at', { ascending: false });
    setRequests(data || []);
  };

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user) return;
    setLoading(true);
    const { error } = await supabase.from('content_requests').insert({
      user_id: user.id,
      title: title.trim(),
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Requested!', description: `"${title}" has been requested.` });
      setTitle('');
      fetchRequests();
    }
    setLoading(false);
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'rejected': return <XCircle className="w-4 h-4 text-destructive" />;
      default: return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const statusVariant = (status: string) => {
    switch (status) {
      case 'approved': return 'default' as const;
      case 'rejected': return 'destructive' as const;
      default: return 'secondary' as const;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background pt-24 flex items-center justify-center">
        <p className="text-muted-foreground">Please sign in to make requests.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-24 px-4 sm:px-8 lg:px-16 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Content Requests</h1>

      <Card className="mb-8 bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">Request a Show or Movie</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitRequest} className="flex gap-3">
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Enter show or movie title..."
              className="bg-secondary border-border"
            />
            <Button type="submit" disabled={loading || !title.trim()}>
              <Plus className="w-4 h-4 mr-2" /> Request
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {requests.map(req => (
          <Card key={req.id} className="bg-card border-border">
            <CardContent className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {statusIcon(req.status)}
                <div>
                  <p className="font-medium">{req.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(req.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <Badge variant={statusVariant(req.status)}>{req.status}</Badge>
            </CardContent>
          </Card>
        ))}
        {requests.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No requests yet. Request something above!</p>
        )}
      </div>
    </div>
  );
}
