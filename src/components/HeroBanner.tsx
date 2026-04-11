import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Info } from 'lucide-react';

interface MediaItem {
  title: string;
  summary: string;
  thumb: string;
  art: string;
  year: number;
  ratingKey: string;
}

interface HeroBannerProps {
  items: MediaItem[];
  onPlay?: (item: MediaItem) => void;
  onInfo?: (item: MediaItem) => void;
}

export default function HeroBanner({ items, onPlay, onInfo }: HeroBannerProps) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => setCurrent(c => (c + 1) % items.length), 8000);
    return () => clearInterval(timer);
  }, [items.length]);

  if (!items.length) {
    return (
      <div className="relative h-[80vh] bg-gradient-to-b from-secondary to-background flex items-center justify-center">
        <div className="text-center px-4">
          <h1 className="text-5xl sm:text-6xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Seth's Streams
          </h1>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto">
            Your personal streaming platform. Browse shows, request new content, and enjoy your library.
          </p>
        </div>
      </div>
    );
  }

  const item = items[current];

  return (
    <div className="relative h-[80vh] overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center transition-all duration-1000"
        style={{ backgroundImage: `url(${item.art || item.thumb})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-background/20" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent" />

      <div className="relative h-full flex items-end pb-24 px-4 sm:px-8 lg:px-16">
        <div className="max-w-2xl space-y-4">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight drop-shadow-lg">{item.title}</h1>
          <div className="flex items-center gap-3 text-sm">
            {item.year && <span className="text-muted-foreground font-medium">{item.year}</span>}
          </div>
          <p className="text-muted-foreground text-sm sm:text-base line-clamp-3 max-w-xl">{item.summary}</p>
          <div className="flex gap-3 pt-2">
            <Button size="lg" className="text-base px-8" onClick={() => onPlay?.(item)}>
              <Play className="w-5 h-5 mr-2 fill-current" /> Play
            </Button>
            <Button size="lg" variant="secondary" className="text-base px-8 bg-foreground/20 hover:bg-foreground/30 backdrop-blur-sm" onClick={() => onInfo?.(item)}>
              <Info className="w-5 h-5 mr-2" /> More Info
            </Button>
          </div>
        </div>
      </div>

      {items.length > 1 && (
        <div className="absolute bottom-8 right-8 flex gap-2">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-1 rounded-full transition-all duration-300 ${i === current ? 'bg-primary w-10' : 'bg-muted-foreground/40 w-4 hover:bg-muted-foreground/60'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
