import { describe, expect, it } from 'vitest';
import {
  normalizePlatformEnvValue,
  parsePlatformEnvMap,
  parsePlatformEnvValue,
} from './platform-env-value.js';
import { doubleValidator } from './platform-env-catalog.js';

describe('normalizePlatformEnvValue', () => {
  it('normalizes bool aliases', () => {
    expect(normalizePlatformEnvValue('bool', 'TRUE')).toBe('true');
    expect(normalizePlatformEnvValue('bool', '0')).toBe('false');
  });

  it('normalizes int and port', () => {
    expect(normalizePlatformEnvValue('int', ' 42 ')).toBe('42');
    expect(normalizePlatformEnvValue('port', '587')).toBe('587');
  });

  it('normalizes double decimals', () => {
    expect(normalizePlatformEnvValue('double', '1.50')).toBe('1.5');
  });

  it('leaves invalid numeric strings unchanged for validate to reject', () => {
    expect(normalizePlatformEnvValue('double', 'xyz')).toBe('xyz');
    expect(normalizePlatformEnvValue('int', '1.2')).toBe('1.2');
  });
});

describe('parsePlatformEnvValue', () => {
  it('parses bool', () => {
    expect(parsePlatformEnvValue('bool', 'true')).toBe(true);
    expect(parsePlatformEnvValue('bool', 'false')).toBe(false);
  });

  it('parses int and port as integers', () => {
    expect(parsePlatformEnvValue('int', '-1')).toBe(-1);
    expect(parsePlatformEnvValue('port', '587')).toBe(587);
  });

  it('parses double as finite number', () => {
    expect(parsePlatformEnvValue('double', '3.14')).toBe(3.14);
    expect(Number.isNaN(parsePlatformEnvValue('double', 'Infinity') as number)).toBe(
      true,
    );
  });

  it('keeps path and string as string', () => {
    expect(parsePlatformEnvValue('path', '/tmp/ws')).toBe('/tmp/ws');
    expect(parsePlatformEnvValue('string', 'x')).toBe('x');
  });
});

describe('parsePlatformEnvMap', () => {
  it('types platform keys from catalog', () => {
    const parsed = parsePlatformEnvMap({
      RXWF_SMTP_SECURE: 'true',
      RXWF_SMTP_PORT: '587',
      RXWF_WORKSPACE_ROOT: '/data',
    });
    expect(parsed.RXWF_SMTP_SECURE).toBe(true);
    expect(parsed.RXWF_SMTP_PORT).toBe(587);
    expect(parsed.RXWF_WORKSPACE_ROOT).toBe('/data');
  });
});

describe('doubleValidator', () => {
  it('accepts finite floats and rejects non-finite', () => {
    expect(doubleValidator()('1.25')).toBeNull();
    expect(doubleValidator(0, 10)('11')).toMatch(/<=/);
    expect(doubleValidator()('NaN')).toMatch(/finite/);
  });
});
