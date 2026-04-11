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
      <div className="relative h-[70vh] bg-gradient-to-b from-secondary to-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">Welcome to PlexStream</h1>
          <p className="text-muted-foreground text-lg">Connect your Plex server to start browsing</p>
        </div>
      </div>
    );
  }

  const item = items[current];

  return (
    <div className="relative h-[70vh] overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center transition-all duration-1000"
        style={{ backgroundImage: `url(${item.art || item.thumb})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-transparent" />

      <div className="relative h-full flex items-end pb-20 px-4 sm:px-8 lg:px-16">
        <div className="max-w-2xl space-y-4">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">{item.title}</h1>
          {item.year && <span className="text-muted-foreground">{item.year}</span>}
          <p className="text-muted-foreground text-sm sm:text-base line-clamp-3">{item.summary}</p>
          <div className="flex gap-3">
            <Button size="lg" onClick={() => onPlay?.(item)}>
              <Play className="w-5 h-5 mr-2" /> Play on Plex
            </Button>
            <Button size="lg" variant="secondary" onClick={() => onInfo?.(item)}>
              <Info className="w-5 h-5 mr-2" /> More Info
            </Button>
          </div>
        </div>
      </div>

      {items.length > 1 && (
        <div className="absolute bottom-6 right-8 flex gap-2">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-3 h-1 rounded-full transition-all ${i === current ? 'bg-primary w-8' : 'bg-muted-foreground/50'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
