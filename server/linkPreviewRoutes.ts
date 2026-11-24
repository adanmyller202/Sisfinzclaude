import express from 'express';

export interface LinkPreviewMetadata {
  url: string;
  normalizedUrl: string;
  domain: string;
  siteName: string;
  title: string;
  description: string;
  image: string | null;
  favicon: string | null;
  isInstagram: boolean;
  previewStatus: 'ok' | 'partial' | 'fallback';
}

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().trim();
  if (!h) return true;
  if (
    h === 'localhost' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    h.endsWith('.localhost')
  ) {
    return true;
  }
  // Block private IPv4 ranges
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  return false;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMetaContent(html: string, keys: string[]): string {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
        'i'
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
        'i'
      ),
    ];
    for (const rx of patterns) {
      const match = html.match(rx);
      if (match?.[1]) {
        const cleaned = decodeHtmlEntities(match[1]);
        if (cleaned) return cleaned;
      }
    }
  }
  return '';
}

function extractHtmlTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? decodeHtmlEntities(match[1]) : '';
}

function extractFaviconHref(html: string): string {
  const patterns = [
    /<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*>/i,
    /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*icon[^"']*["'][^>]*>/i,
  ];
  for (const rx of patterns) {
    const match = html.match(rx);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function resolveAbsoluteUrl(candidate: string, baseUrl: string): string | null {
  if (!candidate) return null;
  try {
    const resolved = new URL(candidate, baseUrl);
    if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
      return resolved.toString();
    }
  } catch {
    // ignore invalid URL
  }
  return null;
}

function buildFallbackMetadata(parsedUrl: URL): LinkPreviewMetadata {
  const domain = parsedUrl.hostname.replace(/^www\./i, '');
  const isInstagram = domain === 'instagram.com' || domain.endsWith('.instagram.com');
  const segments = parsedUrl.pathname.split('/').filter(Boolean);
  let fallbackTitle = domain;

  if (isInstagram) {
    if (segments[0] && !['p', 'reel', 'reels', 'stories', 'explore', 'tv'].includes(segments[0])) {
      fallbackTitle = `@${segments[0]} • Instagram`;
    } else {
      fallbackTitle = 'Publicação no Instagram';
    }
  } else if (segments.length > 0) {
    const lastSeg = decodeURIComponent(segments[segments.length - 1])
      .replace(/[-_]+/g, ' ')
      .replace(/\.\w+$/, '')
      .trim();
    if (lastSeg && lastSeg.length > 2) {
      fallbackTitle = lastSeg.charAt(0).toUpperCase() + lastSeg.slice(1);
    }
  }

  return {
    url: parsedUrl.toString(),
    normalizedUrl: parsedUrl.toString(),
    domain,
    siteName: isInstagram ? 'Instagram' : domain,
    title: fallbackTitle,
    description: '',
    image: null,
    favicon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`,
    isInstagram,
    previewStatus: 'fallback',
  };
}

export async function fetchPublicLinkMetadata(rawUrl: string): Promise<LinkPreviewMetadata> {
  let candidate = rawUrl.trim();
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  const parsed = new URL(candidate);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Protocolo de URL não permitido.');
  }
  if (isBlockedHost(parsed.hostname)) {
    throw new Error('Endereço de rede privada não permitido.');
  }

  const fallback = buildFallbackMetadata(parsed);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);

  try {
    const response = await fetch(parsed.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; SisFinzLinkPreview/1.0; +https://sisfinz.app)',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,es;q=0.8,en;q=0.7',
      },
    });

    if (!response.ok) {
      return fallback;
    }

    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return fallback;
    }

    const finalUrl = response.url || parsed.toString();
    const finalParsed = new URL(finalUrl);
    if (isBlockedHost(finalParsed.hostname)) {
      return fallback;
    }

    // Read up to ~280KB to stay fast and safe
    const reader = response.body?.getReader();
    let html = '';
    if (reader) {
      const decoder = new TextDecoder('utf-8');
      let totalBytes = 0;
      while (totalBytes < 280000) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        html += decoder.decode(value, { stream: true });
        if (html.includes('</head>')) break;
      }
      reader.cancel().catch(() => {});
    } else {
      html = (await response.text()).slice(0, 280000);
    }

    const domain = finalParsed.hostname.replace(/^www\./i, '');
    const isInstagram = domain === 'instagram.com' || domain.endsWith('.instagram.com');

    const ogTitle = extractMetaContent(html, ['og:title', 'twitter:title']);
    const htmlTitle = extractHtmlTitle(html);
    const description = extractMetaContent(html, [
      'og:description',
      'twitter:description',
      'description',
    ]);
    const siteName =
      extractMetaContent(html, ['og:site_name', 'application-name']) ||
      (isInstagram ? 'Instagram' : domain);
    const rawImage = extractMetaContent(html, [
      'og:image:secure_url',
      'og:image',
      'twitter:image',
      'twitter:image:src',
    ]);
    const rawFavicon = extractFaviconHref(html);

    const image = resolveAbsoluteUrl(rawImage, finalUrl);
    const favicon =
      resolveAbsoluteUrl(rawFavicon, finalUrl) ||
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;

    const cleanTitle = (ogTitle || htmlTitle || fallback.title).slice(0, 180);
    const cleanDescription = description.slice(0, 280);

    const previewStatus: LinkPreviewMetadata['previewStatus'] =
      image && cleanTitle
        ? 'ok'
        : cleanTitle !== fallback.title || cleanDescription
        ? 'partial'
        : 'fallback';

    return {
      url: parsed.toString(),
      normalizedUrl: finalUrl,
      domain,
      siteName: siteName.slice(0, 80),
      title: cleanTitle,
      description: cleanDescription,
      image,
      favicon,
      isInstagram,
      previewStatus,
    };
  } catch {
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}

export function mountLinkPreviewRoutes(app: express.Express) {
  app.post('/api/links/preview', async (req, res) => {
    try {
      const rawUrl = String(req.body?.url || '').trim();
      if (!rawUrl) {
        return res.status(400).json({ error: 'URL obrigatória.' });
      }
      const metadata = await fetchPublicLinkMetadata(rawUrl);
      return res.json(metadata);
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || 'URL inválida.' });
    }
  });

  app.get('/api/links/preview', async (req, res) => {
    try {
      const rawUrl = String(req.query?.url || '').trim();
      if (!rawUrl) {
        return res.status(400).json({ error: 'URL obrigatória.' });
      }
      const metadata = await fetchPublicLinkMetadata(rawUrl);
      return res.json(metadata);
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || 'URL inválida.' });
    }
  });
}
