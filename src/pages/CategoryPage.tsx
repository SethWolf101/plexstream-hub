import { useState, useEffect } from 'react';
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

interface CategoryPageProps {
  /** Plex library type: 'movie' or 'show' */
  libraryType: 'movie' | 'show';
  heading: string;
  subheading: string;
}

export default function CategoryPage({ libraryType, heading, subheading }: CategoryPageProps) {
  const [libraries, setLibraries] = useState<{ title: string; items: PlexItem[] }[]>([]);
  const [hero, setHero] = useState<PlexItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<PlexItem | null>(null);
  const [loading, setLoading] = useState(true);

  const apiCall = async (params: Record<string, string>) => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const qs = new URLSearchParams(params).toString();
    return fetch(`https://${projectId}.supabase.co/functions/v1/plex-proxy?${qs}`, {
      headers: { 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
    });
  };

  useEffect(() => {
    (async () => {
      try {
        const libRes = await apiCall({ action: 'libraries' });
        if (!libRes.ok) return;
        const data = await libRes.json();
        const filtered = (data.libraries || []).filter((l: any) => l.type === libraryType);
        const libData = await Promise.all(
          filtered.map(async (lib: any) => {
            const itemsRes = await apiCall({ action: 'library', sectionId: lib.key });
            if (itemsRes.ok) {
              const d = await itemsRes.json();
              return { title: lib.title, items: d.items || [] };
            }
            return { title: lib.title, items: [] };
          })
        );
        setLibraries(libData);
        // Build hero from first 5 items across all sections
        const all: PlexItem[] = libData.flatMap(l => l.items).slice(0, 5);
        setHero(all);
      } catch (err) {
        console.error('Failed to load category:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [libraryType]);

  return (
    <div className="min-h-screen bg-background">
      {hero.length > 0 ? (
        <HeroBanner items={hero} onInfo={(item) => setSelectedItem(item as PlexItem)} />
      ) : (
        <div className="pt-32 pb-16 px-4 sm:px-8 lg:px-16 max-w-7xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold mb-3">{heading}</h1>
          <p className="text-muted-foreground text-lg">{subheading}</p>
        </div>
      )}

      <div className="relative z-10 -mt-20 space-y-2">
        {loading ? (
          <div className="px-4 sm:px-8 lg:px-16 py-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] rounded-md bg-muted animate-pulse" />
              ))}
            </div>
          </div>
        ) : libraries.length === 0 ? (
          <div className="text-center py-20 px-4">
            <h2 className="text-2xl font-bold mb-2">No {heading} libraries found</h2>
            <p className="text-muted-foreground">
              Add a {libraryType === 'movie' ? 'Movies' : 'TV Shows'} library in your Plex server to see content here.
            </p>
          </div>
        ) : (
          libraries.map(lib => (
            <ContentRow key={lib.title} title={lib.title} items={lib.items} onItemClick={(item) => setSelectedItem(item as PlexItem)} />
          ))
        )}
      </div>
      <MediaDetailModal open={!!selectedItem} onOpenChange={() => setSelectedItem(null)} item={selectedItem} />
    </div>
  );
}
