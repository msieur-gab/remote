/**
 * Minimal markdown parser for portfolio content
 * Handles: frontmatter, headers, images, code blocks, blockquotes, lists, inline formatting
 */

/**
 * Parse YAML-like frontmatter from markdown
 * @param {string} md - Raw markdown string
 * @returns {{ frontmatter: Object, content: string }}
 */
export function parseFrontmatter(md) {
  const match = md.match(/^---\n([\s\S]*?)\n---/);

  if (!match) {
    return { frontmatter: {}, content: md };
  }

  const frontmatter = {};
  let currentKey = null;
  let inArray = false;

  match[1].split('\n').forEach(line => {
    // Indented line — either array item or nested key-value
    if (/^\s+/.test(line)) {
      // Array item: "  - value"
      const arrMatch = line.match(/^\s+-\s+(.+)$/);
      if (arrMatch) {
        const value = arrMatch[1].replace(/^["']|["']$/g, '');
        if (currentKey && Array.isArray(frontmatter[currentKey])) {
          frontmatter[currentKey].push(value);
        }
        return;
      }

      // Nested key-value: "  key: value"
      const nestedKv = line.match(/^\s+(\w+):\s+(.+)$/);
      if (nestedKv && currentKey) {
        const nKey = nestedKv[1];
        const nVal = nestedKv[2].replace(/^["']|["']$/g, '');
        // Convert empty array to object if needed
        if (Array.isArray(frontmatter[currentKey]) && frontmatter[currentKey].length === 0) {
          frontmatter[currentKey] = {};
        }
        if (typeof frontmatter[currentKey] === 'object' && !Array.isArray(frontmatter[currentKey])) {
          frontmatter[currentKey][nKey] = nVal;
        }
        return;
      }

      return;
    }

    // Top-level key-value pair
    const kvMatch = line.match(/^(\w+):\s*(.*)$/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      const value = kvMatch[2].replace(/^["']|["']$/g, '');

      // Inline array: [a, b, c]
      const inlineArr = value.match(/^\[\s*(.*?)\s*\]$/);
      if (inlineArr) {
        frontmatter[currentKey] = inlineArr[1]
          ? inlineArr[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, ''))
          : [];
        inArray = false;
      } else if (value === '') {
        frontmatter[currentKey] = [];
        inArray = true;
      } else {
        frontmatter[currentKey] = value;
        inArray = false;
      }
    }
  });

  return {
    frontmatter,
    content: md.slice(match[0].length).trim()
  };
}

/**
 * Convert markdown to HTML
 * @param {string} md - Markdown content (without frontmatter)
 * @param {Object} options
 * @param {string} options.baseUrl - Base URL for relative media paths
 * @returns {string} HTML string
 */
export function markdownToHtml(md, options = {}) {
  const { baseUrl = '' } = options;

  const resolveUrl = (src) => {
    if (src.startsWith('http://') || src.startsWith('https://')) return src;
    if (src.startsWith('/')) return src;
    // Handle relative paths including ../
    const baseParts = baseUrl.split('/').filter(Boolean);
    const srcParts = src.split('/');
    for (const part of srcParts) {
      if (part === '..') baseParts.pop();
      else if (part !== '.') baseParts.push(part);
    }
    return '/' + baseParts.join('/');
  };

  let html = md
    // Prototype directive: ::prototype{src="..." height="..." caption="..."}
    .replace(/::prototype\{([^}]+)\}/g, (_, attrs) => {
      const props = parseDirectiveAttrs(attrs);
      const src = props.src ? sanitizeUrl(resolveUrl(props.src)) : '';
      const height = escapeAttr(props.height || '300');
      const caption = props.caption ? escapeHtml(props.caption) : '';
      const bgAttr = props.bg ? ` bg="${escapeAttr(props.bg)}"` : '';
      return `<figure data-media data-type="prototype">
        <proto-sandbox src="${escapeAttr(src)}" height="${height}"${bgAttr}></proto-sandbox>
        ${caption ? `<figcaption>${caption}</figcaption>` : ''}
      </figure>`;
    })
    // Images / videos with title (for data-fit attribute)
    // ![alt](src "title") -> <figure data-media data-fit="title">
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\s+"([^"]+)"\)/g, (_, alt, src, title) => {
      const safeSrc = escapeAttr(sanitizeUrl(resolveUrl(src)));
      const safeAlt = escapeAttr(alt);
      const safeTitle = escapeAttr(title);
      const tag = mediaTag(src, safeSrc, safeAlt);
      return `<figure data-media data-fit="${safeTitle}">
        ${tag}
        ${alt ? `<figcaption>${escapeHtml(alt)}</figcaption>` : ''}
      </figure>`;
    })
    // Regular images / videos
    // ![alt](src) -> <img> for images, <video> for .webm/.mp4/.mov/.ogv
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
      const safeSrc = escapeAttr(sanitizeUrl(resolveUrl(src)));
      const safeAlt = escapeAttr(alt);
      const tag = mediaTag(src, safeSrc, safeAlt);
      return `<figure data-media>
        ${tag}
        ${alt ? `<figcaption>${escapeHtml(alt)}</figcaption>` : ''}
      </figure>`;
    })
    // Code blocks: charts, flows, and regular code
    .replace(/```([\w-]*)(?:[ \t]+([^\n]*))?\n([\s\S]*?)```/g, (_, lang, options, code) => {
      const opts = options?.trim() || '';
      const content = code.trim();

      // Chart blocks: chart-bar, chart-line, chart-pie, etc.
      // Output as code block with language class for hydration
      // Normalize content to remove blank lines that would cause paragraph splitting
      if (lang.startsWith('chart-')) {
        const normalized = content.replace(/\n\s*\n/g, '\n');
        return `<figure data-media data-type="chart"><pre><code class="language-${lang}">${escapeHtml(normalized)}</code></pre></figure>`;
      }

      // Flow diagram blocks - output as code block for hydration
      if (lang === 'flow') {
        const normalized = content.replace(/\n\s*\n/g, '\n');
        const dirAttr = opts ? ` data-dir="${escapeHtml(opts)}"` : '';
        return `<figure data-media data-type="flow"><pre><code class="language-flow"${dirAttr}>${escapeHtml(normalized)}</code></pre></figure>`;
      }

      // Carousel blocks: list of media paths, one per line.
      // Output as a non-data-media figure so scroll-sync leaves it inline.
      if (lang === 'carousel') {
        const sources = content.split('\n').map(l => l.trim()).filter(Boolean);
        const items = sources.map(src => {
          const safeSrc = escapeAttr(sanitizeUrl(resolveUrl(src)));
          if (VIDEO_EXT.test(src)) {
            return `<li><video src="${safeSrc}" muted playsinline preload="metadata"></video></li>`;
          }
          return `<li><img src="${safeSrc}" alt="" loading="lazy"></li>`;
        }).join('');
        return `<figure data-type="carousel"><ol>${items}</ol></figure>`;
      }

      // Regular code blocks - keep on single line to prevent paragraph splitting
      const langAttr = lang ? ` data-lang="${lang}"` : '';
      return `<figure data-media data-type="code"${langAttr}><pre><code>${escapeHtml(content)}</code></pre></figure>`;
    })
    // Blockquotes -> figure[data-media data-type="quote"]
    .replace(/(?:^> .+$\n?)+/gm, (match) => {
      const lines = match
        .split('\n')
        .map(line => line.replace(/^> ?/, ''))
        .filter(line => line.trim());
      let cite = '';
      const quoteLines = [];
      for (const line of lines) {
        if (/^[——]\s*/.test(line)) {
          cite = `<cite>${escapeHtml(line)}</cite>`;
        } else {
          quoteLines.push(line);
        }
      }
      return `<figure data-media data-type="quote">
        <blockquote>${quoteLines.join('<br>')}${cite}</blockquote>
      </figure>`;
    })
    // Sub-headers (h6 used as overline labels)
    .replace(/^###### (.+)$/gm, (_, t) => `<h6>${escapeHtml(t)}</h6>`)
    // Headers (must come after blockquotes)
    .replace(/^### (.+)$/gm, (_, t) => `<h3>${escapeHtml(t)}</h3>`)
    .replace(/^## (.+)$/gm, (_, t) => `<h2>${escapeHtml(t)}</h2>`)
    .replace(/^# (.+)$/gm, (_, t) => `<h1>${escapeHtml(t)}</h1>`)
    // Lists (must come before inline formatting — * conflicts with emphasis)
    .replace(/(^\* .+$\n?)+/gm, (match) => {
      const items = match.trim().split('\n').map(l => `<li>${l.replace(/^\* /, '')}</li>`).join('\n');
      return `<ul>${items}</ul>`;
    })
    .replace(/(^\d+\. .+$\n?)+/gm, (match) => {
      const items = match.trim().split('\n').map(l => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('\n');
      return `<ol>${items}</ol>`;
    })
    // Definition list pairs:   Term\n: definition  -> <dl><dt>Term</dt><dd>definition</dd></dl>
    // Adjacent pairs are merged into one <dl> by the second replace.
    .replace(/^([A-Za-z0-9][^\n]*)\n:\s+([^\n]+)/gm,
      (_, dt, dd) => `<dl><dt>${dt}</dt><dd>${dd}</dd></dl>`)
    .replace(/<\/dl>(\s*)<dl>/g, '$1')
    // Inline formatting
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/~~([^~]+)~~/g, (_, text) => {
      const redacted = text.replace(/\S/g, 'X');
      return `<del>${redacted}</del>`;
    })
    .replace(/==([^=]+)==/g, '<mark>$1</mark>')
    .replace(/`([^`]+)`/g, (_, code) => `<code>${escapeHtml(code)}</code>`)
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
      const safeUrl = escapeAttr(sanitizeUrl(url));
      return safeUrl ? `<a href="${safeUrl}">${escapeHtml(text)}</a>` : escapeHtml(text);
    });

  // Wrap remaining plain text in paragraphs
  html = html
    .split('\n\n')
    .map(block => {
      block = block.trim();
      if (!block) return '';
      if (block.startsWith('<')) return block;
      return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');

  return html;
}

/**
 * Parse markdown with frontmatter
 * @param {string} md - Raw markdown
 * @param {Object} options
 * @returns {{ html: string, frontmatter: Object }}
 */
export function parseMarkdown(md, options = {}) {
  const { frontmatter, content } = parseFrontmatter(md);
  const html = markdownToHtml(content, options);
  return { html, frontmatter };
}

/**
 * Extract the body of a level-2 section by its heading text.
 *   extractSection(md, 'TL;DR') -> the markdown between "## TL;DR" and the next "## "
 * Heading match is case-insensitive.
 */
export function extractSection(md, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|\\n)##\\s+${escaped}[^\\n]*\\n([\\s\\S]*?)(?:\\n##\\s|$)`, 'i');
  const match = md.match(re);
  return match ? match[1].trim() : '';
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;');
}

function sanitizeUrl(url) {
  const trimmed = (url || '').trim();
  if (/^javascript:/i.test(trimmed) || /^data:/i.test(trimmed) || /^vbscript:/i.test(trimmed)) {
    return '';
  }
  return trimmed;
}

const VIDEO_EXT = /\.(webm|mp4|mov|ogv|m4v)(\?.*)?$/i;
function mediaTag(rawSrc, safeSrc, safeAlt) {
  if (VIDEO_EXT.test(rawSrc)) {
    return `<video src="${safeSrc}" autoplay loop muted playsinline></video>`;
  }
  return `<img src="${safeSrc}" alt="${safeAlt}" loading="lazy">`;
}

/**
 * Parse directive attributes: key="value" key2="value2"
 * @param {string} str - Attribute string
 * @returns {Object} Parsed key-value pairs
 */
function parseDirectiveAttrs(str) {
  const attrs = {};
  const regex = /(\w+)=["']([^"']+)["']/g;
  let match;
  while ((match = regex.exec(str)) !== null) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

/**
 * Convert figure to code block fallback
 * Used when chart/graph plugins are unavailable
 */
function fallbackToCodeBlock(figure, content, lang) {
  figure.dataset.type = 'code';
  figure.dataset.lang = lang;
  figure.innerHTML = `<pre><code>${escapeHtml(content)}</code></pre>`;
  figure.dataset.hydrated = 'true';
}

/**
 * Hydrate chart and flow figures with rendered SVG
 * Falls back to code block display if plugins unavailable
 * @param {Element} container - Container element to search within
 */
export async function hydrateMedia(container) {
  // Hydrate charts using the new hydrate() function
  const chartFigures = container.querySelectorAll('figure[data-type="chart"]');
  if (chartFigures.length > 0) {
    try {
      const { hydrate } = await import('./charts.js');
      // Hydrate charts within this container
      hydrate(container);
      // Mark figures as hydrated
      chartFigures.forEach(fig => fig.dataset.hydrated = 'true');
    } catch (e) {
      console.warn('Chart plugin unavailable:', e.message);
      chartFigures.forEach(fig => {
        const code = fig.querySelector('code');
        if (code) {
          const lang = code.className.match(/language-([\w-]+)/)?.[1] || 'chart';
          fallbackToCodeBlock(fig, code.textContent, lang);
        }
      });
    }
  }

  // Hydrate flow diagrams using the new hydrate() function
  const flowFigures = container.querySelectorAll('figure[data-type="flow"]');
  if (flowFigures.length > 0) {
    try {
      const { hydrate: hydrateFlows } = await import('./graphs.js');
      await hydrateFlows(container);
      flowFigures.forEach(fig => fig.dataset.hydrated = 'true');
    } catch (e) {
      console.warn('Graph plugin unavailable:', e.message);
      flowFigures.forEach(fig => {
        const code = fig.querySelector('code');
        if (code) {
          fallbackToCodeBlock(fig, code.textContent, 'flow');
        }
      });
    }
  }
}
