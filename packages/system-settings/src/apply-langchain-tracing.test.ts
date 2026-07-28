import { afterEach, describe, expect, it } from 'vitest';
import { applyLangChainTracingEnv } from './apply-langchain-tracing.js';

describe('applyLangChainTracingEnv', () => {
  const prior = {
    tracing: process.env.LANGCHAIN_TRACING_V2,
    key: process.env.LANGCHAIN_API_KEY,
    project: process.env.LANGCHAIN_PROJECT,
  };

  afterEach(() => {
    if (prior.tracing === undefined) delete process.env.LANGCHAIN_TRACING_V2;
    else process.env.LANGCHAIN_TRACING_V2 = prior.tracing;
    if (prior.key === undefined) delete process.env.LANGCHAIN_API_KEY;
    else process.env.LANGCHAIN_API_KEY = prior.key;
    if (prior.project === undefined) delete process.env.LANGCHAIN_PROJECT;
    else process.env.LANGCHAIN_PROJECT = prior.project;
  });

  it('sets env when tracing enabled with api key', () => {
    applyLangChainTracingEnv({
      tracingV2: true,
      apiKey: 'test-key',
      project: 'my-project',
    });
    expect(process.env.LANGCHAIN_TRACING_V2).toBe('true');
    expect(process.env.LANGCHAIN_API_KEY).toBe('test-key');
    expect(process.env.LANGCHAIN_PROJECT).toBe('my-project');
  });

  it('clears tracing flag when disabled', () => {
    process.env.LANGCHAIN_TRACING_V2 = 'true';
    applyLangChainTracingEnv({
      tracingV2: false,
      apiKey: 'test-key',
      project: 'x',
    });
    expect(process.env.LANGCHAIN_TRACING_V2).toBeUndefined();
  });
});
