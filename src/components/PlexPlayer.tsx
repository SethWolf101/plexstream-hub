import { useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, Maximize2, Play } from 'lucide-react';
import { plexAuthHeaders, plexStreamUrl, type PlexItem } from '@/lib/plex';

interface PlexPlayerProps {
  item: PlexItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PlexPlayer({ item, open, onOpenChange }: PlexPlayerProps) {
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const source = useMemo(() => (item?.ratingKey ? plexStreamUrl(item.ratingKey) : ''), [item?.ratingKey]);

  useEffect(() => {
    console.log('[PlexPlayer] effect', { open, source, hasVideo: !!videoEl, item });
    if (!open || !source || !videoEl) return;

    const video = videoEl;
    setError('');
    setLoading(true);
    let hls: Hls | null = null;
    console.log('[PlexPlayer] starting playback, Hls supported:', Hls.isSupported());

    const stopLoading = () => setLoading(false);
    const failPlayback = (message = 'Unable to play media.') => {
      setLoading(false);
      setError(message);
    };
    const onVideoError = () => failPlayback(video.error?.message || 'Unable to play media.');

    video.addEventListener('canplay', stopLoading);
    video.addEventListener('playing', stopLoading);
    video.addEventListener('error', onVideoError);

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 60,
        maxMaxBufferLength: 180,
        debug: false,
      });
      hls.loadSource(source);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[PlexPlayer] manifest parsed, attempting play');
        video.play().catch((e) => console.warn('[PlexPlayer] play() rejected', e));
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.error('[PlexPlayer] HLS error', data);
        if (data.fatal) failPlayback(`${data.type}: ${data.details}`);
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = source;
      video.load();
      video.play().catch(() => stopLoading());
    } else {
      failPlayback('This browser cannot play Plex HLS streams.');
    }

    return () => {
      video.removeEventListener('canplay', stopLoading);
      video.removeEventListener('playing', stopLoading);
      video.removeEventListener('error', onVideoError);
      video.pause();
      video.removeAttribute('src');
      video.load();
      hls?.destroy();
      setLoading(false);
    };
  }, [open, source, videoEl]);

  const title = item?.type === 'episode' && item.parentTitle ? `${item.parentTitle} — ${item.title}` : item?.title || 'Player';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl bg-card border-border p-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-base sm:text-lg truncate">{title}</DialogTitle>
        </DialogHeader>
        <div className="bg-background">
          <div className="aspect-video w-full">
            <video ref={videoRef} className="h-full w-full" controls playsInline poster={item?.art || item?.thumb || undefined} />
          </div>
          {loading && !error && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Connecting to Plex stream...</span>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border">
            <div className="min-w-0">
              <p className="font-medium truncate">{title}</p>
              <p className="text-xs text-muted-foreground">High quality Plex streaming inside Seth&apos;s Streams</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => videoRef.current?.requestFullscreen?.()}>
              <Maximize2 className="h-4 w-4 mr-2" /> Fullscreen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
