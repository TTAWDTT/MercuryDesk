const URL_PATTERN = /(https?:\/\/[^\s)]+)(?=[\s)]|$)/g;
const IMAGE_EXT_PATTERN = /\.(?:avif|webp|png|jpe?g|gif|bmp|svg)(?:[?#].*)?$/i;
const HTML_LIKE_PATTERN = /<\/?[a-z][\s\S]*>/i;
const META_TAG_PATTERN = /<meta\b[^>]*>/gi;
const ATTR_PATTERN = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+)/g;
const IMAGE_HOST_HINTS = [
  'hdslb.com',
  'biliimg.com',
  'twimg.com',
  'imgur.com',
  'githubusercontent.com',
  'imgix.net',
  'images',
  'image',
];

export type ParsedContentPreview = {
  isHtml: boolean;
  title: string | null;
  description: string | null;
  url: string | null;
  image: string | null;
  plainText: string;
};

const trimTrailingPunctuation = (value: string) => value.replace(/[)>.,;!?]+$/g, '');

const normalizeText = (value: string | null | undefined) => (value || '').replace(/\s+/g, ' ').trim();

const cleanAttrValue = (value: string) => value.trim().replace(/^['"]|['"]$/g, '').trim();

const toHttpUrl = (value: string | null | undefined, baseUrl?: string | null) => {
  if (!value) return null;
  try {
    const parsed = baseUrl ? new URL(value, baseUrl) : new URL(value);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString();
    return null;
  } catch {
    return null;
  }
};

const pickMetaByRegex = (html: string, keys: string[]) => {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  const tags = html.match(META_TAG_PATTERN) || [];
  for (const tag of tags) {
    const attrs: Record<string, string> = {};
    for (const match of tag.matchAll(ATTR_PATTERN)) {
      attrs[match[1].toLowerCase()] = cleanAttrValue(match[2] || '');
    }
    const key = (attrs.property || attrs.name || '').toLowerCase();
    if (!wanted.has(key)) continue;
    const content = normalizeText(attrs.content);
    if (content) return content;
  }
  return null;
};

const parseHtmlWithDom = (raw: string): ParsedContentPreview => {
  const doc = new DOMParser().parseFromString(raw, 'text/html');
  const pickMeta = (...keys: string[]) => {
    for (const key of keys) {
      const node =
        doc.querySelector(`meta[property="${key}"]`) ||
        doc.querySelector(`meta[name="${key}"]`);
      const content = normalizeText(node?.getAttribute('content'));
      if (content) return content;
    }
    return null;
  };

  const rawUrl =
    pickMeta('og:url', 'twitter:url') ||
    normalizeText(doc.querySelector('a[href]')?.getAttribute('href')) ||
    null;
  const normalizedUrl = toHttpUrl(rawUrl);

  const rawImage =
    pickMeta('og:image', 'og:image:url', 'twitter:image', 'twitter:image:src') ||
    normalizeText(doc.querySelector('img[src]')?.getAttribute('src')) ||
    null;
  const normalizedImage = toHttpUrl(rawImage, normalizedUrl);

  const title =
    pickMeta('og:title', 'twitter:title') ||
    normalizeText(doc.querySelector('title')?.textContent) ||
    normalizeText(doc.querySelector('h1, h2, h3')?.textContent) ||
    null;
  const description =
    pickMeta('og:description', 'twitter:description', 'description') ||
    normalizeText(doc.querySelector('p')?.textContent) ||
    null;
  const plainText = normalizeText(doc.body?.textContent || raw.replace(/<[^>]+>/g, ' '));

  return {
    isHtml: true,
    title,
    description,
    url: normalizedUrl,
    image: normalizedImage,
    plainText,
  };
};

function isLikelyImageUrl(url: string) {
  if (IMAGE_EXT_PATTERN.test(url)) return true;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    if (IMAGE_EXT_PATTERN.test(path)) return true;
    if (IMAGE_HOST_HINTS.some((hint) => host.includes(hint) || path.includes(`/${hint}/`))) return true;
    const format = parsed.searchParams.get('format');
    if (format && ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(format.toLowerCase())) return true;
  } catch {
    return false;
  }
  return false;
}

export function parseContentPreview(raw: string | null | undefined): ParsedContentPreview | null {
  const content = (raw || '').trim();
  if (!content || !HTML_LIKE_PATTERN.test(content)) return null;

  if (typeof DOMParser !== 'undefined') {
    return parseHtmlWithDom(content);
  }

  const title = pickMetaByRegex(content, ['og:title', 'twitter:title']);
  const description = pickMetaByRegex(content, ['og:description', 'twitter:description', 'description']);
  const rawUrl = pickMetaByRegex(content, ['og:url', 'twitter:url']);
  const rawImage = pickMetaByRegex(content, ['og:image', 'og:image:url', 'twitter:image', 'twitter:image:src']);

  return {
    isHtml: true,
    title,
    description,
    url: toHttpUrl(rawUrl),
    image: toHttpUrl(rawImage, rawUrl),
    plainText: normalizeText(content.replace(/<[^>]+>/g, ' ')),
  };
}

export function getPreviewDisplayText(raw: string | null | undefined, fallback = '...') {
  const parsed = parseContentPreview(raw);
  if (parsed) return parsed.description || parsed.plainText || fallback;
  return normalizeText(raw) || fallback;
}

export function extractPreviewImageUrl(raw: string | null | undefined): string | null {
  const parsed = parseContentPreview(raw);
  if (parsed?.image) return parsed.image;

  const text = (raw || '').trim();
  if (!text) return null;

  const markdownImageMatch = text.match(/!\[[^\]]*]\((https?:\/\/[^\s)]+)\)/i);
  if (markdownImageMatch?.[1]) {
    const candidate = trimTrailingPunctuation(markdownImageMatch[1]);
    if (isLikelyImageUrl(candidate)) return candidate;
  }

  const htmlImageMatch = text.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i);
  if (htmlImageMatch?.[1]) {
    const candidate = trimTrailingPunctuation(htmlImageMatch[1]);
    if (isLikelyImageUrl(candidate)) return candidate;
  }

  const urls = text.match(URL_PATTERN) || [];
  for (const rawUrl of urls) {
    const candidate = trimTrailingPunctuation(rawUrl);
    if (isLikelyImageUrl(candidate)) return candidate;
  }

  return null;
}
