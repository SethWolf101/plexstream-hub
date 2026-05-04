import { forwardRef, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Plus } from 'lucide-react';
import { plexApi, type PlexItem, type PlexSeason } from '@/lib/plex';

interface MediaDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PlexItem | null;
  onRequest?: () => void;
  onPlay?: (item: PlexItem) => void;
}

const MediaDetailModal = forwardRef<HTMLDivElement, MediaDetailModalProps>(function MediaDetailModal(
  { open, onOpenChange, item, onRequest, onPlay },
  ref,
) {
  const [seasons, setSeasons] = useState<PlexSeason[]>([]);
  const [episodes, setEpisodes] = useState<PlexItem[]>([]);
  const [selectedSeason, setSelectedSeason] = useState('');
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  useEffect(() => {
    if (!open || !item?.ratingKey || (item.type !== 'show' && item.type !== 'season')) {
      setSeasons([]);
      setEpisodes([]);
      setSelectedSeason('');
      return;
    }

    if (item.type === 'season') {
      setSeasons([]);
      setSelectedSeason(item.ratingKey);
      return;
    }

    let cancelled = false;
    plexApi({ action: 'children', ratingKey: item.ratingKey })
      .then((data) => {
        if (cancelled) return;
        const loaded = (data.items || []).filter((entry: PlexSeason) => entry.type === 'season' && entry.index !== 0);
        setSeasons(loaded);
        setSelectedSeason(loaded[0]?.ratingKey || '');
      })
      .catch(() => setSeasons([]));

    return () => { cancelled = true; };
  }, [open, item?.ratingKey, item?.type]);

  useEffect(() => {
    if (!selectedSeason) {
      setEpisodes([]);
      return;
    }

    let cancelled = false;
    setLoadingEpisodes(true);
    plexApi({ action: 'children', ratingKey: selectedSeason })
      .then((data) => {
        if (!cancelled) setEpisodes((data.items || []).filter((entry: PlexItem) => entry.type === 'episode'));
      })
      .catch(() => setEpisodes([]))
      .finally(() => !cancelled && setLoadingEpisodes(false));

    return () => { cancelled = true; };
  }, [selectedSeason]);

  const defaultPlayable = useMemo(() => {
    if (!item) return null;
    if (item.type === 'show') return episodes[0] || null;
    if (item.type === 'season') return episodes[0] || null;
    return item;
  }, [episodes, item]);

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={ref} className="max-w-4xl bg-card border-border p-0 overflow-hidden">
        {item.art && (
          <div className="relative h-56 overflow-hidden">
            <img src={item.art} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
          </div>
        )}

        <div className="p-6 space-y-5">
          <DialogHeader>
            <DialogTitle className="text-2xl">{item.title}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {item.year && <span>{item.year}</span>}
            {item.contentRating && <span className="border border-border px-2 py-0.5 rounded">{item.contentRating}</span>}
            {item.duration && <span>{Math.round(item.duration / 60000)}min</span>}
            {item.rating && <span>⭐ {item.rating.toFixed(1)}</span>}
          </div>

          {item.genre && <p className="text-sm text-muted-foreground">{item.genre}</p>}
          {item.summary && <p className="text-sm text-muted-foreground leading-relaxed">{item.summary}</p>}

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => defaultPlayable && onPlay?.(defaultPlayable)} disabled={!defaultPlayable}>
              <Play className="w-4 h-4 mr-2" />
              Play
            </Button>
            <Button variant="outline" onClick={onRequest}>
              <Plus className="w-4 h-4 mr-2" />
              Request Similar
            </Button>
          </div>

          {(item.type === 'show' || item.type === 'season') && (
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">Episodes</h3>
                {item.type === 'show' && <Select value={selectedSeason} onValueChange={setSelectedSeason} disabled={!seasons.length}>
                  <SelectTrigger className="w-full sm:w-56 bg-secondary border-border">
                    <SelectValue placeholder="Select season" />
                  </SelectTrigger>
                  <SelectContent>
                    {seasons.map((season) => (
                      <SelectItem key={season.ratingKey} value={season.ratingKey}>
                        {season.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>}
              </div>

              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {loadingEpisodes ? (
                  <div className="h-20 rounded-md bg-muted animate-pulse" />
                ) : episodes.length ? (
                  episodes.map((episode) => (
                    <button
                      key={episode.ratingKey}
                      onClick={() => onPlay?.(episode)}
                      className="w-full flex gap-3 p-3 rounded-md bg-secondary hover:bg-accent text-left transition-colors"
                    >
                      <div className="w-28 aspect-video rounded bg-muted overflow-hidden flex-shrink-0">
                        {episode.thumb ? <img src={episode.thumb} alt={episode.title} className="h-full w-full object-cover" loading="lazy" /> : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{episode.index ? `${episode.index}. ` : ''}{episode.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{episode.summary}</p>
                      </div>
                      <Play className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground py-4">No episodes found for this show.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});

export default MediaDetailModal;
