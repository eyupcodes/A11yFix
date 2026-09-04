/**
 * Target URL validation.
 *
 * A11yFix scans public websites, so a target is accepted only when it is a
 * well-formed `http:`/`https:` URL without embedded credentials and does not
 * obviously point at the machine running the scan or at a private network.
 *
 * Scope limitation (M2): this is a baseline guard for local CLI usage, not a
 * complete SSRF defense. It inspects the literal hostname only. It performs no
 * DNS resolution, so a public hostname that resolves to a private address is
 * still accepted, and redirects are not re-validated. A hosted A11yFix service
 * will need DNS resolution plus post-resolution address checks; the validator
 * is kept side-effect free and synchronous so that layer can be added around it
 * without changing this contract.
 */

import { ScannerError } from './errors.js';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0', '[::]', '[::1]']);

const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function parseIpv4(hostname: string): readonly number[] | null {
  const match = IPV4_PATTERN.exec(hostname);
  if (match === null) {
    return null;
  }

  const octets = match.slice(1).map((part) => Number.parseInt(part, 10));
  if (octets.some((octet) => Number.isNaN(octet) || octet > 255)) {
    return null;
  }

  return octets;
}

/** RFC1918, loopback, link-local, "this network" and shared address space. */
function isPrivateIpv4(octets: readonly number[]): boolean {
  const [a = 0, b = 0] = octets;

  if (a === 0 || a === 10 || a === 127) {
    return true;
  }

  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }

  if (a === 192 && b === 168) {
    return true;
  }

  if (a === 169 && b === 254) {
    return true;
  }

  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }

  return false;
}

function parseIpv4MappedIpv6(address: string): readonly number[] | null {
  if (!address.startsWith('::ffff:')) {
    return null;
  }

  const suffix = address.slice('::ffff:'.length);
  const dotted = parseIpv4(suffix);
  if (dotted !== null) {
    return dotted;
  }

  const words = suffix.split(':');
  if (
    words.length !== 2 ||
    words.some((word) => !/^[\da-f]{1,4}$/.test(word))
  ) {
    return null;
  }

  const [high = 0, low = 0] = words.map((word) => Number.parseInt(word, 16));
  return [high >> 8, high & 0xff, low >> 8, low & 0xff];
}

/** Loopback, unspecified, unique-local (fc00::/7) and link-local (fe80::/10). */
function isPrivateIpv6(hostname: string): boolean {
  if (!hostname.startsWith('[') || !hostname.endsWith(']')) {
    return false;
  }

  const address = hostname.slice(1, -1).toLowerCase();

  if (address === '::1' || address === '::') {
    return true;
  }

  const mappedIpv4 = parseIpv4MappedIpv6(address);
  if (mappedIpv4 !== null) {
    return isPrivateIpv4(mappedIpv4);
  }

  return /^(f[cd]|fe[89ab])/.test(address);
}

function isPrivateHostname(rawHostname: string): boolean {
  const hostname = rawHostname.endsWith('.')
    ? rawHostname.slice(0, -1)
    : rawHostname;

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return true;
  }

  if (hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    return true;
  }

  const octets = parseIpv4(hostname);
  if (octets !== null) {
    return isPrivateIpv4(octets);
  }

  return isPrivateIpv6(hostname);
}

/**
 * Validates a scan target and returns its parsed form.
 *
 * @throws {ScannerError} with code `INVALID_URL`, `UNSUPPORTED_PROTOCOL` or
 * `PRIVATE_TARGET`.
 */
export function validateTargetUrl(rawUrl: string): URL {
  if (typeof rawUrl !== 'string' || rawUrl.trim() === '') {
    throw new ScannerError('INVALID_URL', 'A scan target URL is required.');
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch (cause) {
    throw new ScannerError(
      'INVALID_URL',
      `Could not parse "${rawUrl}" as a URL.`,
      { cause },
    );
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new ScannerError(
      'UNSUPPORTED_PROTOCOL',
      `Unsupported protocol "${parsed.protocol}". Only http: and https: targets can be scanned.`,
    );
  }

  if (parsed.username !== '' || parsed.password !== '') {
    throw new ScannerError(
      'INVALID_URL',
      'Scan targets must not contain embedded credentials.',
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  if (hostname === '') {
    throw new ScannerError(
      'INVALID_URL',
      'Scan targets must contain a hostname.',
    );
  }

  if (isPrivateHostname(hostname)) {
    throw new ScannerError(
      'PRIVATE_TARGET',
      `Refusing to scan "${hostname}": local and private network targets are not allowed.`,
    );
  }

  return parsed;
}
