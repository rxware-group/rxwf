import { describe, expect, it } from 'vitest';
import { buildEditorContextSource, platformEnvItemsToMap, testSettingsToMap } from './build-editor-context-globals.js';

describe('buildEditorContextSource', () => {
  it('does not expose $parameter in context tree', () => {
    const source = buildEditorContextSource({
      definition: {
        name: 'Test',
        nodes: [
          {
            id: 'http1',
            type: 'httpRequest',
            name: 'HTTP',
            position: { x: 0, y: 0 },
            parameters: {
              headerParameters: [{ enabled: true, key: 'X-Test', value: '1' }],
            },
          },
        ],
        connections: [],
        schemaVersion: 1,
      },
      nodeId: 'http1',
    });
    expect(source.contextChildren?.some((node) => node.key === '$parameter')).toBe(false);
    expect(source.contextChildren?.some((node) => node.key === 'headerParameters')).toBe(false);
    expect(source.contextChildren?.map((node) => node.key)).toEqual([
      '$now',
      '$today',
      '$execution',
      '$workflow',
      '$env',
      '$vars',
    ]);
    expect(source.items[0]?.json).toMatchObject({
      $workflow: { name: 'Test' },
      $env: {},
      $vars: {},
    });
  });
});

describe('testSettingsToMap', () => {
  it('includes all variable keys', () => {
    expect(
      testSettingsToMap([
        { key: 'API_BASE', value: 'https://example.com' },
        { key: 'SECRET', value: '***' },
        { key: 'OTHER', value: 'x' },
      ]),
    ).toEqual({
      API_BASE: 'https://example.com',
      SECRET: '***',
      OTHER: 'x',
    });
  });
});

describe('platformEnvItemsToMap', () => {
  it('includes all platform env keys with typed values', () => {
    expect(
      platformEnvItemsToMap([
        { key: 'RXWF_PUBLIC_URL', value: 'http://localhost:8787' },
        { key: 'RXWF_SMTP_HOST', value: 'smtp.example.com' },
        { key: 'RXWF_SMTP_SECURE', value: 'true' },
        { key: 'RXWF_SMTP_PORT', value: '587' },
      ]),
    ).toEqual({
      RXWF_PUBLIC_URL: 'http://localhost:8787',
      RXWF_SMTP_HOST: 'smtp.example.com',
      RXWF_SMTP_SECURE: true,
      RXWF_SMTP_PORT: 587,
    });
  });
});
