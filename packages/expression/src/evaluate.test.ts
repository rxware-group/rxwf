import { describe, it, expect } from 'vitest';
import { AwfError } from '@rxwf/shared';
import { evaluateCondition, evaluateExpression } from './evaluate.js';
import { isExpressionTemplate } from './template-syntax.js';

const sampleNodes = [
  {
    name: 'HTTP',
    json: { status: 200 },
    items: [{ json: { status: 200 } }],
  },
  {
    name: 'Set',
    json: { id: 7 },
    items: [{ json: { id: 7 } }, { json: { id: 8 } }],
  },
];

describe('evaluateExpression', () => {
  it('reads $json field from double-brace template', async () => {
    await expect(
      evaluateExpression('{{ $json.count }}', { json: { count: 2 } }),
    ).resolves.toBe(2);
  });

  it('supports bracket path', async () => {
    await expect(
      evaluateExpression('{{ $json["orderId"] }}', {
        json: { orderId: '1001' },
      }),
    ).resolves.toBe('1001');
  });

  it('evaluates comparisons', async () => {
    await expect(
      evaluateCondition('{{ $json.active === true }}', {
        json: { active: true },
      }),
    ).resolves.toBe(true);
  });

  it('evaluates string equality', async () => {
    await expect(
      evaluateCondition('{{ $json.name === "测试" }}', {
        json: { name: '测试' },
      }),
    ).resolves.toBe(true);
  });

  it('evaluates numeric comparison and logic', async () => {
    await expect(
      evaluateCondition('{{ $json.count > 1 && $json.count < 10 }}', {
        json: { count: 5 },
      }),
    ).resolves.toBe(true);
  });

  it('evaluates negation', async () => {
    await expect(
      evaluateCondition('{{ !$json.disabled }}', { json: { disabled: false } }),
    ).resolves.toBe(true);
  });

  it('rejects assignment in strict mode with E1002', async () => {
    await expect(evaluateExpression('{{ x = 1 }}', { json: {} })).rejects.toThrow(
      AwfError,
    );
  });

  it('detects expression templates', () => {
    expect(isExpressionTemplate('{{ $json.a }}')).toBe(true);
    expect(isExpressionTemplate('plain')).toBe(false);
  });

  it('accepts n8n ={{ }} template prefix', async () => {
    expect(isExpressionTemplate('={{ $json.ok }}')).toBe(true);
    await expect(
      evaluateCondition('={{ $json.ok === true }}', { json: { ok: true } }),
    ).resolves.toBe(true);
  });

  it('reads $env from expression context (AC-6)', async () => {
    await expect(
      evaluateExpression('{{ $env.API_URL }}', {
        json: {},
        env: { API_URL: 'https://dev.example' },
      }),
    ).resolves.toBe('https://dev.example');
  });

  it('reads $vars from expression context', async () => {
    await expect(
      evaluateExpression('{{ $vars.API_BASE }}', {
        json: {},
        vars: { API_BASE: 'https://vars.example' },
      }),
    ).resolves.toBe('https://vars.example');
  });

  it('reads $input array index json path', async () => {
    await expect(
      evaluateExpression('{{ $input[0].json.id }}', {
        json: {},
        input: [{ json: { id: 42 } }, { json: { id: 99 } }],
      }),
    ).resolves.toBe(42);
  });

  it('reads $nodes bracket path from preceding node output', async () => {
    await expect(
      evaluateExpression('{{ $nodes["HTTP"].json.status }}', {
        json: {},
        nodes: sampleNodes,
      }),
    ).resolves.toBe(200);
  });

  it('reads $nodes dot name path', async () => {
    await expect(
      evaluateExpression('{{ $nodes.Set.json.id }}', {
        json: {},
        nodes: sampleNodes,
      }),
    ).resolves.toBe(7);
  });

  it('reads $nodes items array path', async () => {
    await expect(
      evaluateExpression('{{ $nodes["Set"].items[1].json.id }}', {
        json: {},
        nodes: sampleNodes,
      }),
    ).resolves.toBe(8);
  });

  it('throws E1002 for unknown node name', async () => {
    await expect(
      evaluateExpression('{{ $nodes["Missing"].json.x }}', { json: {} }),
    ).rejects.toThrow(AwfError);
  });
});
