import { describe, expect, it } from 'vitest';

import { escapeAttribute, escapeHtml } from './escape.js';

describe('escapeHtml', () => {
  it('escapes special characters', () => {
    expect(escapeHtml('<script>alert("XSS & fun\'s")</script>')).toBe(
      '&lt;script&gt;alert(&quot;XSS &amp; fun&#39;s&quot;)&lt;/script&gt;',
    );
  });

  it('handles null and undefined safely', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('returns plain text unchanged', () => {
    expect(escapeHtml('Hello world 123')).toBe('Hello world 123');
  });
});

describe('escapeAttribute', () => {
  it('escapes quotes and special characters for attributes', () => {
    expect(escapeAttribute('value "with" & \'quotes\' <here>')).toBe(
      'value &quot;with&quot; &amp; &#39;quotes&#39; &lt;here&gt;',
    );
  });
});
