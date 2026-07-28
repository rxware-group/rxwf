import { describe, it, expect } from 'vitest';
import { AwfError } from '@rxwf/shared';
import { evaluateJsExpression, wrapExpressionSource } from './evaluate-js.js';

describe('wrapExpressionSource', () => {
  it('wraps return statement in async IIFE with strict mode', () => {
    expect(wrapExpressionSource('return $json.count')).toBe(
      "(async () => { 'use strict'; return $json.count })()",
    );
  });

  it('wraps bare expression with implicit return', () => {
    expect(wrapExpressionSource('$json.count')).toBe(
      "(async () => { 'use strict'; return $json.count; })()",
    );
  });

  it('wraps statement block without outer return parens', () => {
    expect(wrapExpressionSource('const a = 1; return a')).toBe(
      "(async () => { 'use strict'; const a = 1; return a })()",
    );
  });
});

describe('evaluateJsExpression', () => {
  it('evaluates $json field', async () => {
    const v = await evaluateJsExpression('return $json.count', {
      json: { count: 3 },
    });
    expect(v).toBe(3);
  });

  it('implicit return equals explicit return', async () => {
    const ctx = { json: { count: 3 } };
    const a = await evaluateJsExpression('$json.count', ctx);
    const b = await evaluateJsExpression('return $json.count', ctx);
    expect(a).toBe(3);
    expect(b).toBe(3);
  });

  it('evaluates multi-line block without leading return', async () => {
    const v = await evaluateJsExpression(
      'const n = $json.count;\nreturn n * 2',
      { json: { count: 5 } },
    );
    expect(v).toBe(10);
  });

  it('supports comparisons for conditions', async () => {
    const v = await evaluateJsExpression('return $json.active === true', {
      json: { active: true },
    });
    expect(v).toBe(true);
  });

  it('maps isolate errors to E1002', async () => {
    await expect(
      evaluateJsExpression('return $json.missing.deep', { json: {} }),
    ).rejects.toMatchObject({ code: 'E1002' });
  });

  it('rejects reference to process', async () => {
    await expect(
      evaluateJsExpression('return process.version', { json: {} }),
    ).rejects.toBeInstanceOf(AwfError);
  });

  it('exposes $nodes by display name', async () => {
    const v = await evaluateJsExpression('return $nodes["HTTP"].json.status', {
      json: {},
      nodes: [
        {
          name: 'HTTP',
          json: { status: 200 },
          items: [{ json: { status: 200 } }],
        },
      ],
    });
    expect(v).toBe(200);
  });

  it('exposes typed $env from platform catalog and $vars strings', async () => {
    const v = await evaluateJsExpression(
      'return typeof $env.RXWF_SMTP_SECURE === "boolean" && $env.RXWF_SMTP_SECURE === true ? $vars.STAGE : "no"',
      {
        json: {},
        env: { RXWF_SMTP_SECURE: 'true' },
        vars: { STAGE: 'test' },
      },
    );
    expect(v).toBe('test');
  });

  it('keeps non-catalog $env keys as strings', async () => {
    const v = await evaluateJsExpression(
      'return $env.API_URL + "/" + $vars.STAGE',
      {
        json: {},
        env: { API_URL: 'https://api.example' },
        vars: { STAGE: 'test' },
      },
    );
    expect(v).toBe('https://api.example/test');
  });

  it('exposes $execution and $workflow', async () => {
    const v = await evaluateJsExpression(
      'return $execution.id + ":" + $workflow.name',
      {
        json: {},
        execution: {
          id: 'ex-1',
          mode: 'manual',
          environment: 'test',
        },
        workflow: { id: 'wf-1', name: 'Demo' },
      },
    );
    expect(v).toBe('ex-1:Demo');
  });

  it('exposes $input.all().length', async () => {
    const v = await evaluateJsExpression('return $input.all().length', {
      json: { id: 1 },
      input: [{ json: { id: 1 } }, { json: { id: 2 } }],
      itemIndex: 0,
    });
    expect(v).toBe(2);
  });
});
