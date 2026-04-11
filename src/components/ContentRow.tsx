import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ContentItem {
  ratingKey: string;
  title: string;
  thumb: string;
  year?: number;
  type?: string;
}

interface ContentRowProps {
  title: string;
  items: ContentItem[];
  onItemClick?: (item: ContentItem) => void;
}

export default function ContentRow({ title, items, onItemClick }: ContentRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  if (!items.length) return null;

  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold mb-3 px-4 sm:px-8 lg:px-16">{title}</h2>
      <div className="group relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background"
          onClick={() => scroll('left')}
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>

        <div ref={scrollRef} className="flex gap-2 overflow-x-auto hide-scrollbar px-4 sm:px-8 lg:px-16">
          {items.map(item => (
            <button
              key={item.ratingKey}
              onClick={() => onItemClick?.(item)}
              className="flex-shrink-0 w-[160px] sm:w-[180px] group/card transition-transform hover:scale-105"
            >
              <div className="aspect-[2/3] rounded-md overflow-hidden bg-muted mb-2">
                {item.thumb ? (
                  <img src={item.thumb} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No Image</div>
                )}
              </div>
              <p className="text-sm truncate text-foreground">{item.title}</p>
              {item.year && <p className="text-xs text-muted-foreground">{item.year}</p>}
            </button>
          ))}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background"
          onClick={() => scroll('right')}
        >
          <ChevronRight className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
