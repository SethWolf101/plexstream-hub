import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import HeroBanner from '@/components/HeroBanner';
import ContentRow from '@/components/ContentRow';
import MediaDetailModal from '@/components/MediaDetailModal';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlexData();
  }, []);

  const fetchPlexData = async () => {
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/plex-proxy`;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // Fetch recently added
      const recentRes = await fetch(`${url}?action=recently-added`, {
        headers: { 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
      });
      if (recentRes.ok) {
        const data = await recentRes.json();
        setRecentlyAdded(data.items || []);
      }

      // Fetch libraries
      const libRes = await fetch(`${url}?action=libraries`, {
        headers: { 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
      });
      if (libRes.ok) {
        const data = await libRes.json();
        const libs = data.libraries || [];
        
        const libData = await Promise.all(
          libs.map(async (lib: any) => {
            const itemsRes = await fetch(`${url}?action=library&sectionId=${lib.key}`, {
              headers: { 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
            });
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

  const heroItems = recentlyAdded.slice(0, 5);

  return (
    <div className="min-h-screen bg-background">
      <HeroBanner
        items={heroItems}
        onInfo={(item) => setSelectedItem(item as PlexItem)}
      />

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
            <ContentRow
              title="Recently Added"
              items={recentlyAdded}
              onItemClick={(item) => setSelectedItem(item as PlexItem)}
            />
            {libraries.map(lib => (
              <ContentRow
                key={lib.title}
                title={lib.title}
                items={lib.items}
                onItemClick={(item) => setSelectedItem(item as PlexItem)}
              />
            ))}
          </>
        )}
      </div>

      <MediaDetailModal
        open={!!selectedItem}
        onOpenChange={() => setSelectedItem(null)}
        item={selectedItem}
      />
    </div>
  );
}
