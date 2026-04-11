import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
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

export default function Browse() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlexItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<PlexItem | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timer = setTimeout(() => searchPlex(query), 500);
    return () => clearTimeout(timer);
  }, [query]);

  const searchPlex = async (q: string) => {
    setSearching(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/plex-proxy?action=search&query=${encodeURIComponent(q)}`;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.items || []);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pt-24 px-4 sm:px-8 lg:px-16">
      <div className="max-w-2xl mx-auto mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search your Plex library..."
            className="pl-10 bg-card border-border h-12 text-lg"
          />
        </div>
      </div>

      {searching && <p className="text-center text-muted-foreground">Searching...</p>}

      {results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {results.map(item => (
            <button
              key={item.ratingKey}
              onClick={() => setSelectedItem(item)}
              className="text-left group transition-transform hover:scale-105"
            >
              <div className="aspect-[2/3] rounded-md overflow-hidden bg-muted mb-2">
                {item.thumb ? (
                  <img src={item.thumb} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No Image</div>
                )}
              </div>
              <p className="text-sm truncate">{item.title}</p>
              {item.year && <p className="text-xs text-muted-foreground">{item.year}</p>}
            </button>
          ))}
        </div>
      )}

      {query.length >= 2 && !searching && results.length === 0 && (
        <p className="text-center text-muted-foreground">No results found for "{query}"</p>
      )}

      <MediaDetailModal open={!!selectedItem} onOpenChange={() => setSelectedItem(null)} item={selectedItem} />
    </div>
  );
}
