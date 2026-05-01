export interface PlexItem {
  ratingKey: string;
  title: string;
  summary?: string;
  thumb?: string;
  art?: string;
  year?: number;
  type?: string;
  rating?: number;
  contentRating?: string;
  duration?: number;
  genre?: string;
  parentRatingKey?: string;
  parentTitle?: string;
  parentIndex?: number;
  index?: number;
}

export interface PlexSeason extends PlexItem {
  leafCount?: number;
  viewedLeafCount?: number;
}

export interface PlexLibrary {
  key: string;
  title: string;
  type: string;
}

export async function plexApi(params: Record<string, string>) {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`https://${projectId}.supabase.co/functions/v1/plex-proxy?${qs}`, {
    headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.details || data?.error || 'Plex request failed');
  return data;
}

export function plexStreamUrl(ratingKey: string) {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const qs = new URLSearchParams({ action: 'hls', ratingKey }).toString();
  return `https://${projectId}.supabase.co/functions/v1/plex-proxy?${qs}&apikey=${encodeURIComponent(anonKey)}`;
}

export function splitGenres(item?: Pick<PlexItem, 'genre'> | null) {
  return (item?.genre || '')
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean);
}
