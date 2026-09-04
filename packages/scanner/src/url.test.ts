import { describe, expect, it } from 'vitest';

import { ScannerError, type ScannerErrorCode } from './errors.js';
import { validateTargetUrl } from './url.js';

describe('validateTargetUrl', () => {
  const accepted = [
    'https://example.com',
    'http://example.com/path',
    'https://subdomain.example.com?a=1#section',
    'https://example.com:8443/deep/path',
  ];

  it.each(accepted)('accepts %s', (url) => {
    expect(validateTargetUrl(url).href).toContain('example.com');
  });

  it('preserves the parsed target', () => {
    const parsed = validateTargetUrl(
      'https://subdomain.example.com?a=1#section',
    );

    expect(parsed.protocol).toBe('https:');
    expect(parsed.hostname).toBe('subdomain.example.com');
    expect(parsed.search).toBe('?a=1');
    expect(parsed.hash).toBe('#section');
  });

  const rejected: ReadonlyArray<readonly [string, ScannerErrorCode]> = [
    ['', 'INVALID_URL'],
    ['   ', 'INVALID_URL'],
    ['not a url', 'INVALID_URL'],
    ['example.com', 'INVALID_URL'],
    ['file:///etc/passwd', 'UNSUPPORTED_PROTOCOL'],
    ['data:text/html,<h1>hi</h1>', 'UNSUPPORTED_PROTOCOL'],
    ['javascript:alert(1)', 'UNSUPPORTED_PROTOCOL'],
    ['ftp://example.com/file.txt', 'UNSUPPORTED_PROTOCOL'],
    ['https://user:pass@example.com', 'INVALID_URL'],
    ['https://user@example.com', 'INVALID_URL'],
    ['http://localhost', 'PRIVATE_TARGET'],
    ['http://localhost:3000/page', 'PRIVATE_TARGET'],
    ['http://localhost.', 'PRIVATE_TARGET'],
    ['http://app.localhost', 'PRIVATE_TARGET'],
    ['http://app.localhost.', 'PRIVATE_TARGET'],
    ['http://printer.local', 'PRIVATE_TARGET'],
    ['http://127.0.0.1', 'PRIVATE_TARGET'],
    ['http://127.10.20.30', 'PRIVATE_TARGET'],
    ['http://0.0.0.0', 'PRIVATE_TARGET'],
    ['http://10.0.0.1', 'PRIVATE_TARGET'],
    ['http://172.16.0.1', 'PRIVATE_TARGET'],
    ['http://172.31.255.255', 'PRIVATE_TARGET'],
    ['http://192.168.1.1', 'PRIVATE_TARGET'],
    ['http://169.254.1.1', 'PRIVATE_TARGET'],
    ['http://[::1]', 'PRIVATE_TARGET'],
    ['http://[::ffff:127.0.0.1]', 'PRIVATE_TARGET'],
    ['http://[fe80::1]', 'PRIVATE_TARGET'],
    ['http://[fd00::1]', 'PRIVATE_TARGET'],
  ];

  it.each(rejected)('rejects %s with %s', (url, code) => {
    try {
      validateTargetUrl(url);
      expect.unreachable('expected validateTargetUrl to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ScannerError);
      expect((error as ScannerError).code).toBe(code);
    }
  });

  it('still allows public addresses that merely look similar to private ranges', () => {
    expect(validateTargetUrl('http://172.32.0.1').hostname).toBe('172.32.0.1');
    expect(validateTargetUrl('http://192.169.1.1').hostname).toBe(
      '192.169.1.1',
    );
    expect(validateTargetUrl('http://11.0.0.1').hostname).toBe('11.0.0.1');
  });
});
