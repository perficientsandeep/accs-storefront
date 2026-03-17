/* /blocks/banner/banner.js
 * Robust Edge Delivery Services banner block
 * - Works with flat or row/cell table DOM
 * - Chunks cells into 8-column records
 * - Prefers a.href / img.src (then text)
 * - Sanitizes URLs (whitespace, newlines)
 * - Logs what it parsed & mapped
 * - Renders single banner or simple slider
 */

function truncate(str, len = 300) {
  if (!str) return '';
  return str.length > len ? `${str.slice(0, len)}…(${str.length} chars)` : str;
}

function sanitizeUrl(value) {
  if (!value) return '';
  // remove spaces, newlines, non-breaking spaces
  const cleaned = value.replace(/[\s\u00A0]+/g, '').trim();
  // allow relative URLs like /sale
  if (/^https?:\/\//i.test(cleaned)) {
    try { new URL(cleaned); } catch { console.warn('[banner] Invalid absolute URL:', cleaned); return ''; }
  }
  return cleaned;
}

function readCellValue(node) {
  if (!node) return '';
  // Prefer <a href> (when URLs are hyperlink-formatted)
  const link = node.querySelector && node.querySelector('a[href]');
  if (link?.href) return sanitizeUrl(link.href);

  // Or inline <img src> (if an image was pasted)
  const img = node.querySelector && node.querySelector('img[src]');
  if (img?.src) return sanitizeUrl(img.src);

  // Fallbacks (rare)
  const dataHref = node.getAttribute && node.getAttribute('data-href');
  if (dataHref) return sanitizeUrl(dataHref);
  const dataSrc = node.getAttribute && node.getAttribute('data-src');
  if (dataSrc) return sanitizeUrl(dataSrc);

  // Finally, plain text (for /sale, alt, headline, etc.)
  return (node.textContent || '').trim();
}

function getAllCells(block) {
  // Different projects render tables slightly differently.
  // Try a few shapes and keep the one with the most matches.
  const candidates = [
    // table > row > cell
    [...block.querySelectorAll(':scope > div > div > div')],
    // row > cell (or sometimes this is already "flat cells")
    [...block.querySelectorAll(':scope > div > div')],
    // direct children cells
    [...block.querySelectorAll(':scope > div')],
  ];
  const cells = candidates.sort((a, b) => b.length - a.length)[0];
  console.log('[banner] getAllCells count:', cells.length);
  return cells;
}

function isHeaderChunk(chunk) {
  if (chunk.length !== 8) return false;
  const lower = chunk.map((v) => (v || '').toLowerCase());
  const header = ['banner', 'image', 'mobile image', 'link', 'alt', 'headline', 'subheadline', 'theme'];
  return header.every((h, i) => lower[i] === h);
}

function parseDataRows(block) {
  // Log raw HTML (truncated) so you can confirm the table is inside this block
  console.log('[banner] block.innerHTML:', truncate(block.innerHTML, 600));

  // 1) Flatten all cell nodes in visual order
  const cellNodes = getAllCells(block);
  const flat = cellNodes.map(readCellValue);
  console.log('[banner] flat cells:', flat);

  // 2) Trim out empty cells that some editors inject
  const trimmed = flat.filter((v) => v !== null && v !== undefined && v !== '');
  console.log('[banner] trimmed cells:', trimmed);

  // 3) Chunk every 8 cells into one record
  const CHUNK = 8;
  const chunks = [];
  for (let i = 0; i < trimmed.length; i += CHUNK) {
    chunks.push(trimmed.slice(i, i + CHUNK));
  }
  console.log('[banner] chunks:', chunks);

  // 4) Keep chunks that start with 'banner'
  let rows = chunks.filter((c) => c.length === CHUNK && (c[0] || '').toLowerCase() === 'banner');

  // 5) Drop a header chunk if present
  rows = rows.filter((c) => !isHeaderChunk(c));

  console.log('[banner] data rows (chunks after filter):', rows);

  // 6) Map to our item model
  return rows.map((c, idx) => {
    const item = {
      type: (c[0] || 'banner').toLowerCase(),
      desktop: sanitizeUrl(c[1] || ''),
      mobile: sanitizeUrl(c[2] || ''),
      href: (c[3] || '').trim(),                 // relative links OK
      alt: (c[4] || '').trim(),
      headline: (c[5] || '').trim(),
      subheadline: (c[6] || '').trim(),
      theme: ((c[7] || 'light').trim() || 'light').toLowerCase(),
    };
    console.log(`[banner] row ${idx} mapped:`, item);
    return item;
  });
}

function createPicture({ desktop, mobile, alt }) {
  const picture = document.createElement('picture');

  if (mobile && /^https?:\/\//i.test(mobile)) {
    const source = document.createElement('source');
    source.media = '(max-width: 767px)';
    source.srcset = mobile;
    picture.appendChild(source);
  }

  const img = document.createElement('img');
  img.loading = 'lazy';
  img.decoding = 'async';
  img.alt = alt || '';

  if (/^http:\/\//i.test(desktop)) {
    console.warn('[banner] Mixed-content risk: http image on https page:', desktop);
  }

  img.src = desktop || '';
  img.addEventListener('error', () => {
    console.warn('[banner] Image failed to load. src:', img.src || '(empty)', 'alt:', img.alt || '(empty)');
    img.style.minHeight = '220px';
    img.style.background = '#f2f2f2';
  });
  picture.appendChild(img);

  return picture;
}

function buildBannerDOM(item) {
  const wrapper = document.createElement('div');
  wrapper.className = `banner-wrapper theme-${item.theme || 'light'}`;

  const content = document.createElement('div');
  content.className = 'banner';

  const picture = createPicture({ desktop: item.desktop, mobile: item.mobile, alt: item.alt });

  if (item.href) {
    const a = document.createElement('a');
    a.href = item.href;
    a.className = 'banner-link';
    a.appendChild(picture);
    content.appendChild(a);
  } else {
    content.appendChild(picture);
  }

  if (item.headline || item.subheadline) {
    const overlay = document.createElement('div');
    overlay.className = 'banner-overlay';
    if (item.headline) {
      const h = document.createElement('h3');
      h.className = 'banner-headline';
      h.textContent = item.headline;
      overlay.appendChild(h);
    }
    if (item.subheadline) {
      const p = document.createElement('p');
      p.className = 'banner-subheadline';
      p.textContent = item.subheadline;
      overlay.appendChild(p);
    }
    content.appendChild(overlay);
  }

  wrapper.appendChild(content);
  return wrapper;
}

export default function decorate(block) {
  // Parse BEFORE we clear the original markup
  const items = parseDataRows(block);

  // Clear original table to avoid showing raw data
  block.innerHTML = '';

  if (!items.length) {
    const note = document.createElement('div');
    note.className = 'banner-error';
    note.textContent = 'Banner: No valid data rows parsed. Ensure the first cell is "banner" and columns match.';
    block.appendChild(note);
    console.warn('[banner] No items parsed. Check your table structure.');
    return;
  }

  if (items.length === 1) {
    block.appendChild(buildBannerDOM(items[0]));
  } else {
    // Simple slider when multiple rows are present
    const track = document.createElement('div');
    track.className = 'banner-track';
    items.forEach((it) => {
      const slide = document.createElement('div');
      slide.className = 'banner-slide';
      slide.appendChild(buildBannerDOM(it));
      track.appendChild(slide);
    });

    const slider = document.createElement('div');
    slider.className = 'banner-slider';
    slider.appendChild(track);
    block.appendChild(slider);

    // Auto-advance
    let index = 0;
    const update = () => { track.style.transform = `translateX(-${index * 100}%)`; };
    setInterval(() => { index = (index + 1) % items.length; update(); }, 6000);
  }

  console.log('[banner] Render OK. Items:', items);
}