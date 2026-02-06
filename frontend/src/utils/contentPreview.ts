const URL_PATTERN = /(https?:\/\/[^\s)]+)(?=[\s)]|$)/g;
const IMAGE_EXT_PATTERN = /\.(?:avif|webp|png|jpe?g|gif|bmp|svg)(?:[?#].*)?$/i;
const HTML_LIKE_PATTERN = /<\/?[a-z][\s\S]*>/i;
const META_TAG_PATTERN = /<meta\b[^>]*>/gi;
const ATTR_PATTERN = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+)/g;
const MARKDOWN_HINT_PATTERN = /(^|\n)\s*#{1,6}\s+|!\[[^\]]*]\([^)]+\)|\[[^\]]+]\((https?:\/\/[^)]+)\)/i;
const KEY_VALUE_LINE_PATTERN = /^\s*([A-Za-z\u4e00-\u9fa5 _-]{1,32})\s*[:：]\s*(.+)\s*$/;
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
  format: 'html' | 'json' | 'kv' | 'markdown' | 'text';
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

const extractUrls = (text: string) => (text.match(URL_PATTERN) || []).map((url) => trimTrailingPunctuation(url));

const firstHttpUrl = (text: string, predicate?: (url: string) => boolean) => {
  const urls = extractUrls(text);
  for (const url of urls) {
    const normalized = toHttpUrl(url);
    if (!normalized) continue;
    if (!predicate || predicate(normalized)) return normalized;
  }
  return null;
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
    format: 'html',
    title,
    description,
    url: normalizedUrl,
    image: normalizedImage,
    plainText,
  };
};

const parseHtmlWithoutDom = (content: string): ParsedContentPreview => {
  const title = pickMetaByRegex(content, ['og:title', 'twitter:title']);
  const description = pickMetaByRegex(content, ['og:description', 'twitter:description', 'description']);
  const rawUrl = pickMetaByRegex(content, ['og:url', 'twitter:url']);
  const rawImage = pickMetaByRegex(content, ['og:image', 'og:image:url', 'twitter:image', 'twitter:image:src']);
  const plainText = normalizeText(content.replace(/<[^>]+>/g, ' '));

  return {
    format: 'html',
    title,
    description,
    url: toHttpUrl(rawUrl),
    image: toHttpUrl(rawImage, rawUrl),
    plainText,
  };
};

const toObject = (raw: unknown): Record<string, unknown> | null => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
};

const firstStringByKeys = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && normalizeText(value)) return normalizeText(value);
  }
  return null;
};

const parseJsonPreview = (content: string): ParsedContentPreview | null => {
  if (!/^[\[{]/.test(content.trim())) return null;
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  const object = Array.isArray(parsed) ? toObject(parsed[0]) : toObject(parsed);
  if (!object) return null;

  const nested = toObject(object.preview) || toObject(object.card) || toObject(object.link_preview);
  const source = nested || object;

  const title = firstStringByKeys(source, ['title', 'subject', 'headline', 'name', 'og_title']);
  const description = firstStringByKeys(source, [
    'description',
    'summary',
    'excerpt',
    'text',
    'content',
    'preview',
    'body',
  ]);
  const url = toHttpUrl(firstStringByKeys(source, [
    'url',
    'link',
    'href',
    'source_url',
    'sourceUrl',
    'permalink',
    'og_url',
    'ogUrl',
  ]));
  const image = toHttpUrl(firstStringByKeys(source, [
    'image',
    'image_url',
    'imageUrl',
    'cover',
    'cover_url',
    'coverUrl',
    'thumbnail',
    'thumbnail_url',
    'thumbnailUrl',
    'og_image',
    'ogImage',
    'pic',
  ]), url);
  const plainText = normalizeText(typeof parsed === 'string' ? parsed : JSON.stringify(parsed));

  if (!title && !description && !url && !image) return null;
  return { format: 'json', title, description, url, image, plainText };
};

const KEY_ALIASES = {
  title: ['title', 'subject', 'headline', 'name', '标题', '主题', '名称'],
  description: ['description', 'summary', 'excerpt', 'content', 'text', '摘要', '简介', '描述', '正文'],
  url: ['url', 'link', 'href', 'source', 'permalink', '链接', '原文', '网址', '地址'],
  image: ['image', 'thumbnail', 'cover', 'pic', 'img', '图片', '封面', '缩略图'],
};

const normalizeKey = (key: string) => key.toLowerCase().replace(/\s+/g, '');

const parseKeyValuePreview = (content: string): ParsedContentPreview | null => {
  const lines = content.split(/\r?\n/);
  let title: string | null = null;
  let description: string | null = null;
  let url: string | null = null;
  let image: string | null = null;
  const fallbackLines: string[] = [];
  let matchedCount = 0;

  for (const line of lines) {
    const normalizedLine = line.trim();
    if (!normalizedLine) continue;
    const matched = normalizedLine.match(KEY_VALUE_LINE_PATTERN);
    if (!matched) {
      fallbackLines.push(normalizedLine);
      continue;
    }
    matchedCount += 1;
    const key = normalizeKey(matched[1] || '');
    const value = normalizeText(matched[2] || '');
    if (!value) continue;

    if (KEY_ALIASES.title.some((alias) => normalizeKey(alias) === key)) {
      title = value;
      continue;
    }
    if (KEY_ALIASES.description.some((alias) => normalizeKey(alias) === key)) {
      description = value;
      continue;
    }
    if (KEY_ALIASES.url.some((alias) => normalizeKey(alias) === key)) {
      url = toHttpUrl(value);
      continue;
    }
    if (KEY_ALIASES.image.some((alias) => normalizeKey(alias) === key)) {
      image = toHttpUrl(value, url);
      continue;
    }
    fallbackLines.push(value);
  }

  if (matchedCount === 0) return null;
  const plainText = normalizeText(fallbackLines.join(' '));
  if (!description) description = plainText || null;
  if (!url) url = firstHttpUrl(content, (candidate) => !isLikelyImageUrl(candidate));
  if (!image) image = firstHttpUrl(content, (candidate) => isLikelyImageUrl(candidate));
  return { format: 'kv', title, description, url, image, plainText: normalizeText(content) };
};

const markdownToPlainText = (content: string) =>
  normalizeText(
    content
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
      .replace(/\[([^\]]+)]\(([^)]+)\)/g, '$1 $2')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^[-*+]\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
  );

const parseMarkdownPreview = (content: string): ParsedContentPreview | null => {
  if (!MARKDOWN_HINT_PATTERN.test(content)) return null;
  const heading = normalizeText(content.match(/^\s*#{1,6}\s+(.+)$/m)?.[1] || '');
  const markdownImage = normalizeText(content.match(/!\[[^\]]*]\((https?:\/\/[^\s)]+)\)/i)?.[1] || '');
  const markdownLink = normalizeText(content.match(/\[([^\]]+)]\((https?:\/\/[^\s)]+)\)/i)?.[2] || '');
  const plainText = markdownToPlainText(content);
  const description = normalizeText(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && !line.startsWith('!['))
      .join(' ')
  );
  const url = toHttpUrl(markdownLink) || firstHttpUrl(content, (candidate) => !isLikelyImageUrl(candidate));
  const image = toHttpUrl(markdownImage, url) || firstHttpUrl(content, (candidate) => isLikelyImageUrl(candidate));
  const title = heading || normalizeText(content.match(/\[([^\]]+)]\((https?:\/\/[^\s)]+)\)/i)?.[1] || '') || null;

  if (!title && !description && !url && !image) return null;
  return {
    format: 'markdown',
    title,
    description: description || null,
    url,
    image,
    plainText,
  };
};

const parsePlainTextPreview = (content: string): ParsedContentPreview | null => {
  const plainText = normalizeText(content);
  if (!plainText) return null;
  const url = firstHttpUrl(content, (candidate) => !isLikelyImageUrl(candidate));
  const image = firstHttpUrl(content, (candidate) => isLikelyImageUrl(candidate));

  if (!url && !image) return null;
  return {
    format: 'text',
    title: null,
    description: plainText,
    url,
    image,
    plainText,
  };
};

export function parseContentPreview(raw: string | null | undefined): ParsedContentPreview | null {
  const content = (raw || '').trim();
  if (!content) return null;

  if (HTML_LIKE_PATTERN.test(content)) {
    return typeof DOMParser !== 'undefined' ? parseHtmlWithDom(content) : parseHtmlWithoutDom(content);
  }

  return (
    parseJsonPreview(content) ||
    parseKeyValuePreview(content) ||
    parseMarkdownPreview(content) ||
    parsePlainTextPreview(content)
  );
}

export function getPreviewDisplayText(raw: string | null | undefined, fallback = '...') {
  const parsed = parseContentPreview(raw);
  if (parsed) {
    return parsed.description || parsed.plainText || parsed.title || fallback;
  }
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
