import { useCallback, useEffect, useMemo, useState } from 'react';
import HeroBanner from '@/components/HeroBanner';
import ContentRow from '@/components/ContentRow';
import MediaDetailModal from '@/components/MediaDetailModal';
import PlexPlayer from '@/components/PlexPlayer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Search } from 'lucide-react';
import { plexApi, splitGenres, type PlexItem, type PlexLibrary } from '@/lib/plex';

interface CategoryPageProps {
  libraryType: 'movie' | 'show';
  heading: string;
  subheading: string;
}

export default function CategoryPage({ libraryType, heading, subheading }: CategoryPageProps) {
  const [libraries, setLibraries] = useState<{ title: string; items: PlexItem[] }[]>([]);
  const [hero, setHero] = useState<PlexItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<PlexItem | null>(null);
  const [playingItem, setPlayingItem] = useState<PlexItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [genre, setGenre] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('title');

  const fetchCategory = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const data = await plexApi({ action: 'libraries' });
      const filtered = (data.libraries || []).filter((l: PlexLibrary) => l.type === libraryType);
      const libData = await Promise.all(
        filtered.map(async (lib: PlexLibrary) => {
          const d = await plexApi({ action: 'library', sectionId: lib.key, size: '500' });
          return { title: lib.title, items: d.items || [] };
        })
      );
      setLibraries(libData);
      setHero(libData.flatMap((l) => l.items).slice(0, 5));
    } catch (err) {
      console.error('Failed to load category:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [libraryType]);

  useEffect(() => {
    fetchCategory();
    const interval = window.setInterval(() => fetchCategory(true), 60000);
    const onFocus = () => fetchCategory(true);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchCategory]);

  const genres = useMemo(() => {
    const all = new Set<string>();
    libraries.flatMap((lib) => lib.items).forEach((item) => splitGenres(item).forEach((g) => all.add(g)));
    return Array.from(all).sort((a, b) => a.localeCompare(b));
  }, [libraries]);

  const filteredLibraries = useMemo(() => libraries.map((lib) => {
    const q = search.trim().toLowerCase();
    const items = lib.items
      .filter((item) => genre === 'all' || splitGenres(item).includes(genre))
      .filter((item) => !q || item.title.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sort === 'year') return (b.year || 0) - (a.year || 0);
        if (sort === 'rating') return (b.rating || 0) - (a.rating || 0);
        return a.title.localeCompare(b.title);
      });
    return { ...lib, items };
  }), [genre, libraries, search, sort]);

  const hasResults = filteredLibraries.some((lib) => lib.items.length > 0);

  return (
    <div className="min-h-screen bg-background">
      {hero.length > 0 ? (
        <HeroBanner items={hero} onPlay={(item) => setPlayingItem(item as PlexItem)} onInfo={(item) => setSelectedItem(item as PlexItem)} />
      ) : (
        <div className="pt-32 pb-16 px-4 sm:px-8 lg:px-16 max-w-7xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold mb-3">{heading}</h1>
          <p className="text-muted-foreground text-lg">{subheading}</p>
        </div>
      )}

      <div className="relative z-10 -mt-20 space-y-6 pb-12">
        <div className="px-4 sm:px-8 lg:px-16">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between bg-background/80 backdrop-blur-md border border-border rounded-md p-3">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${heading.toLowerCase()}...`}
                className="pl-9 bg-secondary border-border"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,220px)_minmax(0,160px)_auto] gap-3">
              <Select value={genre} onValueChange={setGenre}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Genre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All genres</SelectItem>
                  {genres.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="title">A-Z</SelectItem>
                  <SelectItem value="year">Newest</SelectItem>
                  <SelectItem value="rating">Top rated</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="secondary" onClick={() => fetchCategory(true)} disabled={refreshing}>
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Scan
              </Button>
            </div>
          </div>
        </div>

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
        ) : hasResults ? (
          filteredLibraries.map((lib) => (
            <ContentRow key={lib.title} title={lib.title} items={lib.items} layout="grid" onItemClick={(item) => setSelectedItem(item as PlexItem)} />
          ))
        ) : (
          <p className="text-center text-muted-foreground py-12">No {heading.toLowerCase()} match these filters.</p>
        )}
      </div>
      <MediaDetailModal open={!!selectedItem} onOpenChange={() => setSelectedItem(null)} item={selectedItem} onPlay={(item) => setPlayingItem(item)} />
      <PlexPlayer open={!!playingItem} onOpenChange={() => setPlayingItem(null)} item={playingItem} />
    </div>
  );
}
