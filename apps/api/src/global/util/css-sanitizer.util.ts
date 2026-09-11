/**
 * Allowlist CSS sanitizer for tenant custom widget CSS (PLN-260910 P5, C′).
 *
 * The widget iframe shares the API origin and shows conversation text, so
 * arbitrary CSS is an exfiltration vector (attribute selectors + url()) and a
 * UI-redress vector (hide the consent notice, move the send button). This
 * sanitizer is therefore an allowlist in three dimensions, not a denylist:
 *
 *  - selectors: only the widget's stable `.st-*` classes, descendant/child
 *    combinators between them, and a few harmless pseudo-classes;
 *  - properties: paint and typography only — nothing that can hide, move or
 *    overlay (display, visibility, opacity, position, transform, content, …);
 *  - values: a tight character set with no url(), no @, no escapes, and only
 *    colour/variable functions.
 *
 * Anything it cannot fully accept is dropped and reported, never "fixed".
 * No parser dependency on purpose: the grammar we accept is small enough to
 * validate directly, and a full parser would only widen what gets through.
 */

export const CUSTOM_CSS_MAX_BYTES = 32 * 1024;

const ALLOWED_PROPERTIES = new Set([
  'color',
  'background',
  'background-color',
  'border',
  'border-color',
  'border-width',
  'border-style',
  'border-radius',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-left-radius',
  'border-bottom-right-radius',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'letter-spacing',
  'text-transform',
  'text-decoration',
  'text-align',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'gap',
  'box-shadow',
  'outline',
  'outline-color',
  'outline-offset',
  'width',
  'min-width',
  'max-width',
  'height',
  'min-height',
  'max-height',
]);

/** Selector grammar: `.st-a`, `.st-a .st-b`, `.st-a > .st-b`, optional pseudo-class at the end. */
const SELECTOR_RE =
  /^\.st-[a-z0-9-]+(?:\s*(?:>\s*)?\.st-[a-z0-9-]+)*(?::(?:hover|focus|focus-visible|active|first-child|last-child|disabled))?$/;

/** Value charset. No `;` `{` `}` `\` `/` `<` `>` `@` `:` — none of which any allowed value needs. */
const VALUE_RE = /^[a-zA-Z0-9 #%.,\-()'"!]+$/;
/** Only colour/variable functions; `var(` must reference the widget's own tokens. */
const FUNCTION_RE = /([a-zA-Z-]+)\(/g;
const ALLOWED_FUNCTIONS = new Set(['rgb', 'rgba', 'hsl', 'hsla', 'var']);

export interface SanitizedCss {
  css: string;
  /** Human-readable reasons for everything that was dropped (for the console). */
  dropped: string[];
}

function validValue(value: string): boolean {
  if (!VALUE_RE.test(value)) return false;
  if (/url\s*\(|expression|javascript|import|@/i.test(value)) return false;
  let m: RegExpExecArray | null;
  FUNCTION_RE.lastIndex = 0;
  while ((m = FUNCTION_RE.exec(value))) {
    const fn = m[1].toLowerCase();
    if (!ALLOWED_FUNCTIONS.has(fn)) return false;
    if (fn === 'var' && !/var\(\s*--ivy-[a-z0-9-]+\s*\)/i.test(value.slice(m.index))) return false;
  }
  return true;
}

export function sanitizeWidgetCss(input: string | null | undefined): SanitizedCss {
  const dropped: string[] = [];
  if (!input) return { css: '', dropped };
  let src = String(input);
  if (Buffer.byteLength(src, 'utf8') > CUSTOM_CSS_MAX_BYTES) {
    dropped.push(`stylesheet exceeds ${CUSTOM_CSS_MAX_BYTES / 1024}KB — truncated`);
    src = src.slice(0, CUSTOM_CSS_MAX_BYTES);
  }
  // Comments carry nothing we keep and are the classic place to hide a `{`.
  src = src.replace(/\/\*[\s\S]*?\*\//g, '');

  const out: string[] = [];
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf('{', i);
    if (open < 0) {
      if (src.slice(i).trim()) dropped.push(`trailing text without a rule: "${src.slice(i).trim().slice(0, 40)}"`);
      break;
    }
    const close = src.indexOf('}', open);
    if (close < 0) {
      dropped.push('unterminated rule');
      break;
    }
    let selectorText = src.slice(i, open).trim();
    const body = src.slice(open + 1, close);
    i = close + 1;

    // Statement at-rules (`@import …;`, `@charset …;`) end with `;` before the
    // next selector: report each on its own so the rule that follows still
    // gets judged on its merits.
    if (selectorText.includes(';')) {
      const parts = selectorText.split(';');
      selectorText = parts.pop()!.trim();
      for (const stmt of parts.map((p) => p.trim()).filter(Boolean)) {
        dropped.push(`statement not allowed: "${stmt.slice(0, 40)}"`);
      }
    }

    if (body.includes('{')) {
      dropped.push(`nested block under "${selectorText.slice(0, 40)}"`);
      continue;
    }
    if (selectorText.startsWith('@')) {
      dropped.push(`at-rule "${selectorText.slice(0, 40)}"`);
      continue;
    }
    const selectors = selectorText.split(',').map((s) => s.trim().replace(/\s+/g, ' '));
    const badSelector = selectors.find((s) => !SELECTOR_RE.test(s));
    if (badSelector !== undefined) {
      dropped.push(`selector not allowed: "${badSelector.slice(0, 40)}" (use .st-* classes)`);
      continue;
    }

    const decls: string[] = [];
    for (const raw of body.split(';')) {
      const decl = raw.trim();
      if (!decl) continue;
      const colon = decl.indexOf(':');
      if (colon < 0) {
        dropped.push(`malformed declaration "${decl.slice(0, 40)}"`);
        continue;
      }
      const prop = decl.slice(0, colon).trim().toLowerCase();
      const value = decl.slice(colon + 1).trim();
      if (!ALLOWED_PROPERTIES.has(prop)) {
        dropped.push(`property not allowed: ${prop}`);
        continue;
      }
      if (!validValue(value)) {
        dropped.push(`value not allowed for ${prop}: "${value.slice(0, 40)}"`);
        continue;
      }
      decls.push(`${prop}: ${value}`);
    }
    if (decls.length) out.push(`${selectors.join(', ')} { ${decls.join('; ')}; }`);
  }
  return { css: out.join('\n'), dropped };
}
