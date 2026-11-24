import express from 'express';

function isPrivateOrBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h.endsWith('.local') ||
    h.endsWith('.internal')
  ) {
    return true;
  }
  if (/^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) {
    return true;
  }
  const m172 = h.match(/^172\.(\d+)\./);
  if (m172) {
    const second = Number(m172[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

function extractMetaContent(html: string, attrName: string, attrValue: string): string {
  const escaped = attrValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern1 = new RegExp(
    `<meta[^>]*${attrName}=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    'i'
  );
  const pattern2 = new RegExp(
    `<meta[^>]*content=["']([^"']+)["'][^>]*${attrName}=["']${escaped}["'][^>]*>`,
    'i'
  );
  const m = html.match(pattern1) || html.match(pattern2);
  return m ? decodeHtmlEntities(m[1].trim()) : '';
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function resolveAbsoluteUrl(baseUrl: string, candidate: string): string | null {
  if (!candidate) return null;
  try {
    const resolved = new URL(candidate, baseUrl);
    if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
      return resolved.toString();
    }
  } catch {
    // ignore
  }
  return null;
}

export function mountLinkPreviewRoutes(app: express.Express) {
  app.get('/api/notes/link-preview', async (req, res) => {
    const rawUrl = String(req.query.url || '').trim();
    if (!rawUrl) {
      return res.status(400).json({ error: 'URL obrigatória.' });
    }

    let parsed: URL;
    try {
      parsed = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return res.status(400).json({ error: 'Protocolo inválido.' });
      }
      if (isPrivateOrBlockedHost(parsed.hostname)) {
        return res.status(400).json({ error: 'Host não permitido.' });
      }
    } catch {
      return res.status(400).json({ error: 'URL inválida.' });
    }

    const domain = parsed.hostname.replace(/^www\./, '');
    const defaultFavicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
      domain
    )}&sz=128`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5500);

    try {
      const response = await fetch(parsed.toString(), {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; SisFinzLinkPreview/1.0; +https://sisfinz.app)',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return res.json({
          url: parsed.toString(),
          domain,
          siteName: domain,
          title: domain,
          description: '',
          image: null,
          favicon: defaultFavicon,
        });
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        return res.json({
          url: parsed.toString(),
          domain,
          siteName: domain,
          title: domain,
          description: '',
          image: null,
          favicon: defaultFavicon,
        });
      }

      const html = (await response.text()).slice(0, 120000);
      const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const ogTitle =
        extractMetaContent(html, 'property', 'og:title') ||
        extractMetaContent(html, 'name', 'twitter:title') ||
        (titleTagMatch ? decodeHtmlEntities(titleTagMatch[1].trim()) : '');

      const ogDescription =
        extractMetaContent(html, 'property', 'og:description') ||
        extractMetaContent(html, 'name', 'description') ||
        extractMetaContent(html, 'name', 'twitter:description');

      const ogSiteName = extractMetaContent(html, 'property', 'og:site_name') || domain;
      const rawImage =
        extractMetaContent(html, 'property', 'og:image') ||
        extractMetaContent(html, 'name', 'twitter:image');

      const image = resolveAbsoluteUrl(parsed.toString(), rawImage);

      return res.json({
        url: parsed.toString(),
        domain,
        siteName: ogSiteName,
        title: ogTitle || domain,
        description: ogDescription.slice(0, 240),
        image,
        favicon: defaultFavicon,
      });
    } catch {
      clearTimeout(timeout);
      return res.json({
        url: parsed.toString(),
        domain,
        siteName: domain,
        title: domain,
        description: '',
        image: null,
        favicon: defaultFavicon,
      });
    }
  });
}
