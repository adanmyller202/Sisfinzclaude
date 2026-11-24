export interface LinkPreviewMetadata {
  url: string;
  domain: string;
  siteName: string;
  title: string;
  description: string;
  image: string | null;
  favicon: string | null;
  platform: 'instagram' | 'youtube' | 'tiktok' | 'pinterest' | 'web';
  isFallback: boolean;
}

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function isValidHttpUrl(raw: string): boolean {
  try {
    const parsed = new URL(normalizeUrl(raw));
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      Boolean(parsed.hostname && parsed.hostname.includes('.'))
    );
  } catch {
    return false;
  }
}

export function detectPlatform(hostname: string): LinkPreviewMetadata['platform'] {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'instagram.com' || host.endsWith('.instagram.com') || host === 'instagr.am') {
    return 'instagram';
  }
  if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be') {
    return 'youtube';
  }
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
    return 'tiktok';
  }
  if (host === 'pinterest.com' || host.endsWith('.pinterest.com') || host === 'pin.it') {
    return 'pinterest';
  }
  return 'web';
}

export function buildFallbackMetadata(rawUrl: string): LinkPreviewMetadata {
  const normalized = normalizeUrl(rawUrl);
  let domain = normalized;
  let pathname = '';
  try {
    const u = new URL(normalized);
    domain = u.hostname.replace(/^www\./, '');
    pathname = u.pathname;
  } catch {
    // keep raw
  }

  const platform = detectPlatform(domain);
  let siteName = domain;
  let title = domain;

  if (platform === 'instagram') {
    siteName = 'Instagram';
    const segs = pathname.split('/').filter(Boolean);
    if (segs.length >= 1 && !['p', 'reel', 'reels', 'tv', 'stories', 'explore'].includes(segs[0])) {
      title = `@${segs[0]} • Instagram`;
    } else if (segs[0] === 'reel' || segs[0] === 'reels') {
      title = 'Reel no Instagram';
    } else {
      title = 'Publicação no Instagram';
    }
  } else if (platform === 'youtube') {
    siteName = 'YouTube';
    title = 'Vídeo no YouTube';
  } else if (platform === 'tiktok') {
    siteName = 'TikTok';
    title = 'Vídeo no TikTok';
  } else if (platform === 'pinterest') {
    siteName = 'Pinterest';
    title = 'Pin no Pinterest';
  } else {
    const cleanBrand = domain.split('.')[0] || domain;
    siteName = cleanBrand.charAt(0).toUpperCase() + cleanBrand.slice(1);
    const lastSeg = pathname
      .split('/')
      .filter(Boolean)
      .pop()
      ?.replace(/[-_]+/g, ' ')
      .replace(/\.[a-z0-9]+$/i, '')
      .trim();
    if (lastSeg && lastSeg.length >= 3) {
      title = lastSeg.charAt(0).toUpperCase() + lastSeg.slice(1);
    } else {
      title = siteName;
    }
  }

  return {
    url: normalized,
    domain,
    siteName,
    title,
    description: '',
    image: null,
    favicon: domain.includes('.')
      ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`
      : null,
    platform,
    isFallback: true,
  };
}

export async function fetchLinkPreviewMetadata(
  rawUrl: string,
  signal?: AbortSignal
): Promise<LinkPreviewMetadata> {
  const normalized = normalizeUrl(rawUrl);
  const fallback = buildFallbackMetadata(normalized);

  if (!isValidHttpUrl(normalized)) {
    return fallback;
  }

  // 1. Try secure SisFinz backend endpoint first (when mounted)
  try {
    const resp = await fetch(
      `/api/notes/link-preview?url=${encodeURIComponent(normalized)}`,
      { signal }
    );
    if (resp.ok) {
      const data = await resp.json();
      if (data && (data.title || data.image || data.description)) {
        return {
          url: normalized,
          domain: data.domain || fallback.domain,
          siteName: data.siteName || fallback.siteName,
          title: data.title || fallback.title,
          description: data.description || '',
          image: typeof data.image === 'string' && data.image.startsWith('http') ? data.image : null,
          favicon: data.favicon || fallback.favicon,
          platform: fallback.platform,
          isFallback: false,
        };
      }
    }
  } catch {
    // Fallback to public Open Graph metadata API below
  }

  // 2. Fallback to public Open Graph metadata resolver (CORS-safe, respects public metadata only)
  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 6500);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort, { once: true });

    const resp = await fetch(
      `https://api.microlink.io/?url=${encodeURIComponent(normalized)}`,
      { signal: controller.signal }
    );
    window.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onAbort);

    if (resp.ok) {
      const json = await resp.json();
      const d = json?.data;
      if (d) {
        const imgUrl =
          typeof d.image?.url === 'string' && d.image.url.startsWith('http')
            ? d.image.url
            : null;
        const logoUrl =
          typeof d.logo?.url === 'string' && d.logo.url.startsWith('http')
            ? d.logo.url
            : fallback.favicon;
        const cleanTitle =
          typeof d.title === 'string' && d.title.trim() && !/^login\b/i.test(d.title.trim())
            ? d.title.trim()
            : fallback.title;
        const cleanDesc =
          typeof d.description === 'string' ? d.description.trim().slice(0, 220) : '';
        const cleanPublisher =
          typeof d.publisher === 'string' && d.publisher.trim()
            ? d.publisher.trim()
            : fallback.siteName;

        return {
          url: normalized,
          domain: fallback.domain,
          siteName: cleanPublisher,
          title: cleanTitle,
          description: cleanDesc,
          image: imgUrl,
          favicon: logoUrl,
          platform: fallback.platform,
          isFallback: !imgUrl && cleanTitle === fallback.title && !cleanDesc,
        };
      }
    }
  } catch {
    // Return honest fallback card without fabricating covers
  }

  return fallback;
}
