export interface PlexItem {
  ratingKey: string;
  title: string;
  summary: string;
  thumb: string;
  art: string;
  year?: number;
  type?: string;
  rating?: number;
  contentRating?: string;
  duration?: number;
  genre?: string;
  parentRatingKey?: string;
  parentTitle?: string;
  parentIndex?: number;
  grandparentRatingKey?: string;
  grandparentTitle?: string;
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

export function plexAuthHeaders() {
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return { Authorization: `Bearer ${anonKey}`, apikey: anonKey };
}

export function splitGenres(item?: Pick<PlexItem, 'genre'> | null) {
  return (item?.genre || '')
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean);
}

/** Resolves the next episode to auto-play after `item` finishes (same season, then next season). */
export async function getNextEpisode(item?: PlexItem | null): Promise<PlexItem | null> {
  if (!item || item.type !== 'episode' || !item.parentRatingKey) return null;

  try {
    const seasonData = await plexApi({ action: 'children', ratingKey: item.parentRatingKey });
    const episodes: PlexItem[] = (seasonData.items || []).filter((e: PlexItem) => e.type === 'episode');
    const idx = episodes.findIndex((e) => e.ratingKey === item.ratingKey);
    if (idx >= 0 && episodes[idx + 1]) return episodes[idx + 1];

    if (!item.grandparentRatingKey) return null;
    const showData = await plexApi({ action: 'children', ratingKey: item.grandparentRatingKey });
    const seasons: PlexItem[] = (showData.items || []).filter((s: PlexItem) => s.type === 'season' && s.index !== 0);
    const sIdx = seasons.findIndex((s) => s.ratingKey === item.parentRatingKey);
    const nextSeason = sIdx >= 0 ? seasons[sIdx + 1] : null;
    if (!nextSeason) return null;

    const nextData = await plexApi({ action: 'children', ratingKey: nextSeason.ratingKey });
    const nextEpisodes: PlexItem[] = (nextData.items || []).filter((e: PlexItem) => e.type === 'episode');
    return nextEpisodes[0] || null;
  } catch {
    return null;
  }
}
