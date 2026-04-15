import { forwardRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Play, Plus } from 'lucide-react';

interface MediaDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    title: string;
    summary?: string;
    thumb?: string;
    art?: string;
    year?: number;
    rating?: number;
    contentRating?: string;
    duration?: number;
    genre?: string;
  } | null;
  onRequest?: () => void;
}

const MediaDetailModal = forwardRef<HTMLDivElement, MediaDetailModalProps>(function MediaDetailModal(
  { open, onOpenChange, item, onRequest },
  ref,
) {
  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={ref} className="max-w-2xl bg-card border-border p-0 overflow-hidden">
        {item.art && (
          <div className="relative h-48 overflow-hidden">
            <img src={item.art} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
          </div>
        )}

        <div className="p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-2xl">{item.title}</DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {item.year && <span>{item.year}</span>}
            {item.contentRating && <span className="border border-border px-2 py-0.5 rounded">{item.contentRating}</span>}
            {item.duration && <span>{Math.round(item.duration / 60000)}min</span>}
            {item.rating && <span>⭐ {item.rating.toFixed(1)}</span>}
          </div>

          {item.genre && <p className="text-sm text-muted-foreground">{item.genre}</p>}
          {item.summary && <p className="text-sm text-muted-foreground leading-relaxed">{item.summary}</p>}

          <div className="flex gap-3">
            <Button>
              <Play className="w-4 h-4 mr-2" />
              Play on Plex
            </Button>
            <Button variant="outline" onClick={onRequest}>
              <Plus className="w-4 h-4 mr-2" />
              Request Similar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});

export default MediaDetailModal;
