import { useState, useEffect } from 'react';
import HeroBanner from '@/components/HeroBanner';
import ContentRow from '@/components/ContentRow';
import MediaDetailModal from '@/components/MediaDetailModal';
import PlexPlayer from '@/components/PlexPlayer';

interface PlexItem {
  ratingKey: string;
  title: string;
  summary: string;
  thumb: string;
  art: string;
  year: number;
  type?: string;
  rating?: number;
  contentRating?: string;
  duration?: number;
  genre?: string;
}

export default function Index() {
  const [recentlyAdded, setRecentlyAdded] = useState<PlexItem[]>([]);
  const [libraries, setLibraries] = useState<{ title: string; items: PlexItem[] }[]>([]);
  const [selectedItem, setSelectedItem] = useState<PlexItem | null>(null);
  const [playingItem, setPlayingItem] = useState<PlexItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlexData();
  }, []);

  const apiCall = async (params: Record<string, string>) => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const qs = new URLSearchParams(params).toString();
    return fetch(`https://${projectId}.supabase.co/functions/v1/plex-proxy?${qs}`, {
      headers: { 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
    });
  };

  const fetchPlexData = async () => {
    try {
      const recentRes = await apiCall({ action: 'recently-added' });
      if (recentRes.ok) {
        const data = await recentRes.json();
        setRecentlyAdded(data.items || []);
      }

      const libRes = await apiCall({ action: 'libraries' });
      if (libRes.ok) {
        const data = await libRes.json();
        const libs = data.libraries || [];
        const libData = await Promise.all(
          libs.map(async (lib: any) => {
            const itemsRes = await apiCall({ action: 'library', sectionId: lib.key });
            if (itemsRes.ok) {
              const d = await itemsRes.json();
              return { title: lib.title, items: d.items || [] };
            }
            return { title: lib.title, items: [] };
          })
        );
        setLibraries(libData);
      }
    } catch (err) {
      console.error('Failed to fetch Plex data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <HeroBanner items={recentlyAdded.slice(0, 5)} onPlay={(item) => setPlayingItem(item as PlexItem)} onInfo={(item) => setSelectedItem(item as PlexItem)} />
      <div className="relative z-10 -mt-20 space-y-2">
        {loading ? (
          <div className="px-4 sm:px-8 lg:px-16 py-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] rounded-md bg-muted animate-pulse" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <ContentRow title="Recently Added" items={recentlyAdded} onItemClick={(item) => setSelectedItem(item as PlexItem)} />
            {libraries.map(lib => (
              <ContentRow key={lib.title} title={lib.title} items={lib.items} onItemClick={(item) => setSelectedItem(item as PlexItem)} />
            ))}
            {recentlyAdded.length === 0 && libraries.length === 0 && (
              <div className="text-center py-20">
                <h2 className="text-2xl font-bold mb-2">Welcome to Seth's Streams</h2>
                <p className="text-muted-foreground">Connect your Plex server to start browsing your library.</p>
              </div>
            )}
          </>
        )}
      </div>
      <MediaDetailModal open={!!selectedItem} onOpenChange={() => setSelectedItem(null)} item={selectedItem} onPlay={(item) => setPlayingItem(item as PlexItem)} />
      <PlexPlayer open={!!playingItem} onOpenChange={() => setPlayingItem(null)} item={playingItem} />
    </div>
  );
}
