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
  isProfile?: boolean;
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
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
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

function cleanTrackingParams(parsed: URL): URL {
  const copy = new URL(parsed.toString());
  const paramsToStrip = [
    'igsh',
    'igshid',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'fbclid',
  ];
  for (const key of paramsToStrip) {
    copy.searchParams.delete(key);
  }
  return copy;
}

function isGenericInstagramImage(imageUrl: string | null): boolean {
  if (!imageUrl) return true;
  const lower = imageUrl.toLowerCase();
  return (
    lower.includes('static.cdninstagram.com/rsrc.php') ||
    lower.includes('/static/images/ico/') ||
    lower.includes('instagram_logo') ||
    lower.includes('ig-logo') ||
    lower.includes('rsrc.php/')
  );
}

function isGenericLoginDescription(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('crie uma conta ou entre no instagram') ||
    lower.includes('create an account or log in to instagram') ||
    lower.includes('crea una cuenta o inicia sesión en instagram') ||
    lower.includes('welcome back to instagram') ||
    lower.includes('inicia sesión para ver fotos') ||
    lower.includes('entre no instagram para ver')
  );
}

function isGenericLoginTitle(text: string): boolean {
  const lower = text.trim().toLowerCase();
  return (
    !lower ||
    lower === 'instagram' ||
    lower === 'login • instagram' ||
    lower === 'entrar • instagram' ||
    lower === 'iniciar sesión • instagram'
  );
}

function needsImageProxy(imageUrl: string): boolean {
  try {
    const host = new URL(imageUrl).hostname.toLowerCase();
    return (
      host.includes('cdninstagram.com') ||
      host.includes('fbcdn.net') ||
      host.includes('instagram.com')
    );
  } catch {
    return false;
  }
}

function buildFallbackMetadata(parsedUrl: URL): LinkPreviewMetadata {
  const domain = parsedUrl.hostname.replace(/^www\./i, '');
  const isInstagram = domain === 'instagram.com' || domain.endsWith('.instagram.com');
  const segments = parsedUrl.pathname.split('/').filter(Boolean);
  let fallbackTitle = domain;
  let isProfile = false;

  if (isInstagram) {
    if (
      segments[0] &&
      !['p', 'reel', 'reels', 'stories', 'explore', 'tv', 'accounts'].includes(segments[0])
    ) {
      fallbackTitle = `@${segments[0]}`;
      isProfile = true;
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
    isProfile,
    previewStatus: 'fallback',
  };
}

async function fetchHtmlHeadWithUserAgent(
  targetUrl: string,
  userAgent: string,
  timeoutMs = 6500
): Promise<{ html: string; finalUrl: string } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,es-AR;q=0.8,en;q=0.7',
      },
    });

    if (!response.ok) return null;

    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return null;
    }

    const finalUrl = response.url || targetUrl;
    const finalParsed = new URL(finalUrl);
    if (isBlockedHost(finalParsed.hostname)) return null;

    const reader = response.body?.getReader();
    let html = '';
    if (reader) {
      const decoder = new TextDecoder('utf-8');
      let totalBytes = 0;
      while (totalBytes < 320000) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        html += decoder.decode(value, { stream: true });
        if (html.includes('</head>')) break;
      }
      reader.cancel().catch(() => {});
    } else {
      html = (await response.text()).slice(0, 320000);
    }

    return { html, finalUrl };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
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

  const cleanParsed = cleanTrackingParams(parsed);
  const fallback = buildFallbackMetadata(cleanParsed);

  // For Instagram/Meta links, use official Open Graph preview crawler User-Agents so Meta returns real profile/post metadata instead of the login wall
  const userAgents = fallback.isInstagram
    ? [
        'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'WhatsApp/2.23.20.0',
        'Twitterbot/1.0',
      ]
    : [
        'Mozilla/5.0 (compatible; SisFinzLinkPreview/1.0; +https://sisfinz.app)',
        'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      ];

  let bestResult: LinkPreviewMetadata = fallback;

  for (const ua of userAgents) {
    const fetched = await fetchHtmlHeadWithUserAgent(cleanParsed.toString(), ua);
    if (!fetched) continue;

    const { html, finalUrl } = fetched;
    const finalParsed = new URL(finalUrl);
    const domain = finalParsed.hostname.replace(/^www\./i, '');
    const isInstagram =
      fallback.isInstagram || domain === 'instagram.com' || domain.endsWith('.instagram.com');

    const ogTitle = extractMetaContent(html, ['og:title', 'twitter:title']);
    const htmlTitle = extractHtmlTitle(html);
    const rawDesc = extractMetaContent(html, [
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

    const resolvedImage = resolveAbsoluteUrl(rawImage, finalUrl);
    const validImage =
      resolvedImage && !(isInstagram && isGenericInstagramImage(resolvedImage))
        ? needsImageProxy(resolvedImage)
          ? `/api/links/image?url=${encodeURIComponent(resolvedImage)}`
          : resolvedImage
        : null;

    const cleanTitleCandidate =
      (!isGenericLoginTitle(ogTitle) && ogTitle) ||
      (!isGenericLoginTitle(htmlTitle) && htmlTitle) ||
      fallback.title;

    const cleanDescription = isGenericLoginDescription(rawDesc) ? '' : rawDesc.slice(0, 280);

    const favicon =
      resolveAbsoluteUrl(rawFavicon, finalUrl) ||
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;

    const previewStatus: LinkPreviewMetadata['previewStatus'] =
      validImage && !isGenericLoginTitle(cleanTitleCandidate)
        ? 'ok'
        : cleanDescription || cleanTitleCandidate !== fallback.title
        ? 'partial'
        : 'fallback';

    const candidateMeta: LinkPreviewMetadata = {
      url: parsed.toString(),
      normalizedUrl: cleanParsed.toString(),
      domain,
      siteName: siteName.slice(0, 80),
      title: cleanTitleCandidate.slice(0, 180),
      description: cleanDescription,
      image: validImage,
      favicon,
      isInstagram,
      isProfile: fallback.isProfile,
      previewStatus,
    };

    if (previewStatus === 'ok') {
      return candidateMeta;
    }
    if (previewStatus === 'partial' && bestResult.previewStatus === 'fallback') {
      bestResult = candidateMeta;
    }
  }

  return bestResult;
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

  // Safe image proxy so Instagram/Meta CDN images (which send CORP: same-origin) render reliably on iPhone/Web
  app.get('/api/links/image', async (req, res) => {
    const rawUrl = String(req.query?.url || '').trim();
    if (!rawUrl) {
      return res.status(400).end();
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return res.status(400).end();
      }
      if (isBlockedHost(parsed.hostname)) {
        return res.status(403).end();
      }
    } catch {
      return res.status(400).end();
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const upstream = await fetch(parsed.toString(), {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
      });

      if (!upstream.ok) {
        return res.status(404).end();
      }

      const contentType = String(upstream.headers.get('content-type') || '').toLowerCase();
      if (!contentType.startsWith('image/')) {
        return res.status(415).end();
      }

      const arrayBuf = await upstream.arrayBuffer();
      if (arrayBuf.byteLength > 5 * 1024 * 1024) {
        return res.status(413).end();
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=21600');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      return res.send(Buffer.from(arrayBuf));
    } catch {
      return res.status(502).end();
    } finally {
      clearTimeout(timeout);
    }
  });
}
