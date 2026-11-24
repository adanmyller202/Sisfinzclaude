import express from 'express';
import { mountReceiptScanRoutes } from './receiptScanRoutes';

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
  previewSource?: string;
}

const RESERVED_IG_SEGMENTS = new Set([
  'p',
  'reel',
  'reels',
  'stories',
  'explore',
  'tv',
  'accounts',
  'direct',
  'about',
  'legal',
  'developer',
  'api',
  'static',
  'graphql',
]);

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
    .replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    })
    .replace(/\\\//g, '/')
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
    const resolved = new URL(decodeHtmlEntities(candidate), baseUrl);
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

function extractInstagramTarget(parsed: URL): {
  isInstagram: boolean;
  username: string | null;
  postType: 'p' | 'reel' | 'tv' | null;
  shortcode: string | null;
} {
  const domain = parsed.hostname.replace(/^www\./i, '').toLowerCase();
  if (domain !== 'instagram.com' && !domain.endsWith('.instagram.com')) {
    return { isInstagram: false, username: null, postType: null, shortcode: null };
  }
  const segments = parsed.pathname.split('/').filter(Boolean);
  const first = segments[0]?.toLowerCase() || '';

  if ((first === 'p' || first === 'reel' || first === 'reels' || first === 'tv') && segments[1]) {
    const postType = first === 'reels' ? 'reel' : (first as 'p' | 'reel' | 'tv');
    return { isInstagram: true, username: null, postType, shortcode: segments[1] };
  }

  if (first && !RESERVED_IG_SEGMENTS.has(first)) {
    return {
      isInstagram: true,
      username: segments[0].replace(/^@/, ''),
      postType: null,
      shortcode: null,
    };
  }

  return { isInstagram: true, username: null, postType: null, shortcode: null };
}

function isGenericInstagramImage(imageUrl: string | null): boolean {
  if (!imageUrl) return true;
  const lower = imageUrl.toLowerCase();
  return (
    lower.includes('static.cdninstagram.com/rsrc.php') ||
    lower.includes('/static/images/ico/') ||
    lower.includes('instagram_logo') ||
    lower.includes('ig-logo') ||
    lower.includes('rsrc.php/') ||
    lower.includes('static.xx.fbcdn.net/rsrc.php') ||
    lower.includes('default-avatar')
  );
}

function isGenericLoginDescription(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('crie uma conta ou entre no instagram') ||
    lower.includes('bem-vindo novamente ao instagram') ||
    lower.includes('cadastre-se para conferir') ||
    lower.includes('create an account or log in to instagram') ||
    lower.includes('welcome back to instagram') ||
    lower.includes('sign in to check out what your friends') ||
    lower.includes('crea una cuenta o inicia sesión en instagram') ||
    lower.includes('te damos la bienvenida de nuevo a instagram') ||
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
    lower === 'iniciar sesión • instagram' ||
    lower === 'instagram.com'
  );
}

function needsImageProxy(imageUrl: string): boolean {
  try {
    const host = new URL(imageUrl).hostname.toLowerCase();
    return (
      host.includes('cdninstagram.com') ||
      host.includes('fbcdn.net') ||
      host.includes('instagram.com') ||
      host.includes('unavatar.io')
    );
  } catch {
    return false;
  }
}

function wrapImageUrl(imageUrl: string | null, isInstagram: boolean): string | null {
  if (!imageUrl) return null;
  if (isInstagram && isGenericInstagramImage(imageUrl)) return null;
  if (needsImageProxy(imageUrl)) {
    return `/api/links/image?url=${encodeURIComponent(imageUrl)}`;
  }
  return imageUrl;
}

function buildFallbackMetadata(parsedUrl: URL): LinkPreviewMetadata {
  const domain = parsedUrl.hostname.replace(/^www\./i, '');
  const ig = extractInstagramTarget(parsedUrl);
  const segments = parsedUrl.pathname.split('/').filter(Boolean);

  let fallbackTitle = domain;
  if (ig.isInstagram) {
    fallbackTitle = ig.username ? `@${ig.username} • Instagram` : 'Publicação no Instagram';
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
    siteName: ig.isInstagram ? 'Instagram' : domain,
    title: fallbackTitle,
    description: '',
    image: null,
    favicon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`,
    isInstagram: ig.isInstagram,
    isProfile: Boolean(ig.username),
    previewStatus: 'fallback',
    previewSource: 'fallback',
  };
}

async function tryInstagramEmbedPage(
  ig: { username: string | null; postType: 'p' | 'reel' | 'tv' | null; shortcode: string | null },
  originalUrl: string,
  normalizedUrl: string
): Promise<LinkPreviewMetadata | null> {
  const embedUrl = ig.username
    ? `https://www.instagram.com/${encodeURIComponent(ig.username)}/embed/`
    : ig.postType && ig.shortcode
    ? `https://www.instagram.com/${ig.postType}/${encodeURIComponent(ig.shortcode)}/embed/captioned/`
    : null;

  if (!embedUrl) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const resp = await fetch(embedUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,es-AR;q=0.8,en;q=0.7',
      },
    });
    if (!resp.ok) return null;
    const html = (await resp.text()).slice(0, 450000);

    const avatarMatch =
      html.match(/"profile_pic_url_hd"\s*:\s*"([^"]+)"/i) ||
      html.match(/"profile_pic_url"\s*:\s*"([^"]+)"/i) ||
      html.match(/class="[^"]*(?:HeaderAvatar|Avatar)[^"]*"[\s\S]{0,250}?<img[^>]+src="([^"]+)"/i) ||
      html.match(/<img[^>]+class="[^"]*EmbeddedMediaImage[^"]*"[^>]+src="([^"]+)"/i) ||
      html.match(/"display_url"\s*:\s*"([^"]+)"/i);

    const fullNameMatch =
      html.match(/"full_name"\s*:\s*"([^"]+)"/i) ||
      html.match(/class="[^"]*FullName[^"]*"[^>]*>([^<]+)</i);

    const usernameMatch =
      html.match(/"username"\s*:\s*"([^"]+)"/i) ||
      html.match(/class="[^"]*UsernameText[^"]*"[^>]*>([^<]+)</i);

    const bioMatch =
      html.match(/"biography"\s*:\s*"([^"]+)"/i) ||
      html.match(/class="[^"]*Caption[^"]*"[^>]*>([\s\S]{1,260}?)<\/div>/i);

    const rawPic = avatarMatch?.[1] ? resolveAbsoluteUrl(avatarMatch[1], embedUrl) : null;
    const image = wrapImageUrl(rawPic, true);

    const fullName = fullNameMatch?.[1] ? decodeHtmlEntities(fullNameMatch[1]) : '';
    const handle = usernameMatch?.[1]
      ? decodeHtmlEntities(usernameMatch[1]).replace(/^@/, '')
      : ig.username || '';
    const bio = bioMatch?.[1]
      ? decodeHtmlEntities(bioMatch[1].replace(/<[^>]*>/g, ' '))
      : '';

    if (!image && !fullName && !bio) return null;

    const title = fullName && handle
      ? `${fullName} (@${handle}) • Perfil de Instagram`
      : fullName
      ? `${fullName} • Instagram`
      : handle
      ? `@${handle} • Perfil de Instagram`
      : 'Publicação no Instagram';

    return {
      url: originalUrl,
      normalizedUrl,
      domain: 'instagram.com',
      siteName: 'Instagram',
      title: title.slice(0, 180),
      description: isGenericLoginDescription(bio) ? '' : bio.slice(0, 280),
      image,
      favicon: 'https://www.google.com/s2/favicons?domain=instagram.com&sz=128',
      isInstagram: true,
      isProfile: Boolean(ig.username),
      previewStatus: image ? 'ok' : 'partial',
      previewSource: 'ig_embed',
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function tryInstagramWebProfileInfo(
  username: string,
  originalUrl: string,
  normalizedUrl: string
): Promise<LinkPreviewMetadata | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const resp = await fetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
      {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
          'x-ig-app-id': '936619743392459',
          Accept: 'application/json',
          'Accept-Language': 'pt-BR,pt;q=0.9,es-AR;q=0.8,en;q=0.7',
          Referer: `https://www.instagram.com/${username}/`,
        },
      }
    );

    if (!resp.ok) return null;
    const json: any = await resp.json().catch(() => null);
    const user = json?.data?.user;
    if (!user) return null;

    const fullName = String(user.full_name || '').trim();
    const handle = String(user.username || username).trim();
    const bio = String(user.biography || '').trim();
    const rawPic = String(user.profile_pic_url_hd || user.profile_pic_url || '').trim();
    const image = wrapImageUrl(rawPic || null, true);

    const title = fullName
      ? `${fullName} (@${handle}) • Perfil de Instagram`
      : `@${handle} • Perfil de Instagram`;

    return {
      url: originalUrl,
      normalizedUrl,
      domain: 'instagram.com',
      siteName: 'Instagram',
      title: title.slice(0, 180),
      description: bio.slice(0, 280),
      image,
      favicon: 'https://www.google.com/s2/favicons?domain=instagram.com&sz=128',
      isInstagram: true,
      isProfile: true,
      previewStatus: image ? 'ok' : 'partial',
      previewSource: 'ig_web_profile',
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function tryUnavatarInstagramImage(username: string): Promise<string | null> {
  const target = `https://unavatar.io/instagram/${encodeURIComponent(username)}?fallback=false`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5500);
  try {
    const resp = await fetch(target, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'image/*,*/*;q=0.8',
      },
    });
    if (!resp.ok) return null;
    const ct = String(resp.headers.get('content-type') || '').toLowerCase();
    if (!ct.startsWith('image/')) return null;
    const buf = await resp.arrayBuffer();
    if (buf.byteLength < 1200) return null;
    return `/api/links/image?url=${encodeURIComponent(target)}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function tryDubMetatags(
  targetUrl: string,
  originalUrl: string,
  fallback: LinkPreviewMetadata
): Promise<LinkPreviewMetadata | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const resp = await fetch(
      `https://api.dub.co/metatags?url=${encodeURIComponent(targetUrl)}`,
      {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      }
    );
    if (!resp.ok) return null;
    const data: any = await resp.json().catch(() => null);
    if (!data) return null;

    const rawTitle = decodeHtmlEntities(String(data.title || ''));
    const rawDesc = decodeHtmlEntities(String(data.description || ''));
    const rawImage = String(data.image || '').trim();

    const image = wrapImageUrl(rawImage || null, fallback.isInstagram);
    const title = !isGenericLoginTitle(rawTitle) ? rawTitle : fallback.title;
    const description = isGenericLoginDescription(rawDesc) ? '' : rawDesc.slice(0, 280);

    const previewStatus: LinkPreviewMetadata['previewStatus'] = image
      ? 'ok'
      : description || title !== fallback.title
      ? 'partial'
      : 'fallback';

    if (previewStatus === 'fallback') return null;

    return {
      url: originalUrl,
      normalizedUrl: targetUrl,
      domain: fallback.domain,
      siteName: fallback.siteName,
      title: title.slice(0, 180),
      description,
      image,
      favicon: fallback.favicon,
      isInstagram: fallback.isInstagram,
      isProfile: fallback.isProfile,
      previewStatus,
      previewSource: 'dub_metatags',
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function tryMicrolinkPreview(
  targetUrl: string,
  originalUrl: string,
  fallback: LinkPreviewMetadata
): Promise<LinkPreviewMetadata | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const resp = await fetch(
      `https://api.microlink.io/?url=${encodeURIComponent(targetUrl)}`,
      {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      }
    );
    if (!resp.ok) return null;
    const json: any = await resp.json().catch(() => null);
    const data = json?.data;
    if (!data) return null;

    const rawTitle = decodeHtmlEntities(String(data.title || ''));
    const rawDesc = decodeHtmlEntities(String(data.description || ''));
    const rawImage = String(data.image?.url || data.logo?.url || '').trim();
    const rawLogo = String(data.logo?.url || '').trim();
    const siteName = decodeHtmlEntities(String(data.publisher || fallback.siteName));

    const image = wrapImageUrl(rawImage || null, fallback.isInstagram);
    const title = !isGenericLoginTitle(rawTitle) ? rawTitle : fallback.title;
    const description = isGenericLoginDescription(rawDesc) ? '' : rawDesc.slice(0, 280);

    const previewStatus: LinkPreviewMetadata['previewStatus'] = image
      ? 'ok'
      : description || title !== fallback.title
      ? 'partial'
      : 'fallback';

    if (previewStatus === 'fallback') return null;

    return {
      url: originalUrl,
      normalizedUrl: targetUrl,
      domain: fallback.domain,
      siteName: (siteName || fallback.siteName).slice(0, 80),
      title: title.slice(0, 180),
      description,
      image,
      favicon:
        (rawLogo && !isGenericInstagramImage(rawLogo) ? rawLogo : null) || fallback.favicon,
      isInstagram: fallback.isInstagram,
      isProfile: fallback.isProfile,
      previewStatus,
      previewSource: 'microlink',
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchHtmlHeadWithUserAgent(
  targetUrl: string,
  userAgent: string,
  timeoutMs = 5500
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
  const ig = extractInstagramTarget(cleanParsed);

  let bestResult: LinkPreviewMetadata = fallback;

  if (ig.isInstagram) {
    const [embedRes, profileRes, dubRes, microlinkRes, unavatarImg] = await Promise.all([
      tryInstagramEmbedPage(ig, parsed.toString(), cleanParsed.toString()),
      ig.username
        ? tryInstagramWebProfileInfo(ig.username, parsed.toString(), cleanParsed.toString())
        : Promise.resolve(null),
      tryDubMetatags(cleanParsed.toString(), parsed.toString(), fallback),
      tryMicrolinkPreview(cleanParsed.toString(), parsed.toString(), fallback),
      ig.username ? tryUnavatarInstagramImage(ig.username) : Promise.resolve(null),
    ]);

    const candidates = [profileRes, embedRes, dubRes, microlinkRes].filter(
      (c): c is LinkPreviewMetadata => Boolean(c)
    );

    const bestOk = candidates.find((c) => c.previewStatus === 'ok');
    if (bestOk) {
      return bestOk;
    }

    const bestPartial = candidates.find((c) => c.previewStatus === 'partial');
    if (bestPartial) {
      bestResult = bestPartial;
    }

    if (unavatarImg && !bestResult.image) {
      return {
        ...bestResult,
        image: unavatarImg,
        previewStatus: 'ok',
        previewSource: `${bestResult.previewSource || 'fallback'}+unavatar`,
      };
    }

    if (bestResult.previewStatus !== 'fallback') {
      return bestResult;
    }
  }

  const userAgents = [
    'Mozilla/5.0 (compatible; SisFinzLinkPreview/1.0; +https://sisfinz.app)',
    'WhatsApp/2.24.16.76 A',
  ];

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
    const validImage = wrapImageUrl(resolvedImage, isInstagram);

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
      previewSource: 'direct_og',
    };

    if (previewStatus === 'ok') {
      return candidateMeta;
    }
    if (previewStatus === 'partial' && bestResult.previewStatus === 'fallback') {
      bestResult = candidateMeta;
    }
  }

  if (!ig.isInstagram) {
    const [dubRes, microlinkRes] = await Promise.all([
      tryDubMetatags(cleanParsed.toString(), parsed.toString(), fallback),
      tryMicrolinkPreview(cleanParsed.toString(), parsed.toString(), fallback),
    ]);
    const pick =
      [dubRes, microlinkRes].find((c) => c?.previewStatus === 'ok') ||
      [dubRes, microlinkRes].find((c) => c?.previewStatus === 'partial');
    if (pick) return pick;
  }

  return bestResult;
}

export function mountLinkPreviewRoutes(app: express.Express) {
  // Also mount receipt/ticket scanner endpoint here so server.ts stays untouched
  mountReceiptScanRoutes(app);

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
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          Referer: 'https://www.instagram.com/',
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
